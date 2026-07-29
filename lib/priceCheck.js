// Logika pengecekan harga vs TP/SL — dipakai oleh cron DAN tombol "Refresh harga" manual.
// Menangani dua kelas aset: crypto (harga dari Bitget, banyak simbol sekaligus) dan
// gold/XAUUSD (harga dari Yahoo Finance, satu simbol saja).
import { fetchAllTickers, tickersToPriceMap } from "@/lib/bitget";
import { fetchGoldQuote } from "@/lib/goldPrice";

export async function checkPrices(supabase) {
  const { data: signals, error } = await supabase
    .from("signals")
    .select("*")
    .in("status", ["active", "tp1", "tp2"]);

  if (error) throw new Error(error.message);

  const results = [];
  const now = new Date().toISOString();

  if (signals && signals.length > 0) {
    const cryptoSignals = signals.filter((s) => (s.asset_class || "crypto") === "crypto");
    const goldSignals = signals.filter((s) => s.asset_class === "gold");

    let prices = {};
    if (cryptoSignals.length > 0) {
      const tickers = await fetchAllTickers();
      prices = tickersToPriceMap(tickers);
    }

    let goldPrice = null;
    if (goldSignals.length > 0) {
      try {
        goldPrice = await fetchGoldQuote();
      } catch (e) {
        results.push({ symbol: "XAUUSD", note: "harga gold tidak tersedia: " + e.message });
      }
    }

    for (const s of cryptoSignals) {
      const price = prices[s.symbol];
      await applyPriceUpdate(supabase, s, price, now, results);
    }
    for (const s of goldSignals) {
      await applyPriceUpdate(supabase, s, goldPrice, now, results);
    }
  }

  return { checked: signals ? signals.length : 0, results };
}

async function applyPriceUpdate(supabase, s, price, now, results) {
  if (!price) {
    results.push({ symbol: s.symbol, note: "harga tidak ditemukan" });
    return;
  }

  const update = { current_price: price, last_checked_at: now };

  // --- Logika penilaian (long only) ---
  // SL kena sebelum TP1 -> loss, closed
  // TP1 sudah kena lalu harga balik <= entry -> tutup sebagai win kecil (amankan TP1)
  // TP naik bertahap: tp1 -> tp2 -> tp3 (tp3 = closed win penuh)
  const risk = s.entry - s.stop_loss;

  if (s.status === "active" && price <= s.stop_loss) {
    update.status = "sl";
    update.result = "loss";
    update.rr_achieved = -1;
    update.closed_at = now;
  } else if (["tp1", "tp2"].includes(s.status) && price <= s.entry) {
    update.result = "win";
    update.rr_achieved = round2((s.tp1 - s.entry) / risk);
    update.closed_at = now;
    update.status = s.status;
  } else if (s.tp3 && price >= s.tp3) {
    update.status = "tp3";
    update.result = "win";
    update.rr_achieved = round2((s.tp3 - s.entry) / risk);
    update.closed_at = now;
  } else if (s.tp2 && price >= s.tp2 && s.status !== "tp2") {
    update.status = "tp2";
  } else if (price >= s.tp1 && s.status === "active") {
    update.status = "tp1";
  }

  await supabase.from("signals").update(update).eq("id", s.id);
  results.push({ symbol: s.symbol, price, status: update.status || s.status });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
