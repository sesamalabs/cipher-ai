import { createAdminClient } from "@/lib/supabaseAdmin";
import { fetchAllTickers } from "@/lib/bitget";

const STABLE = ["USDCUSDT", "DAIUSDT", "TUSDUSDT", "FDUSDUSDT", "USDPUSDT", "EURUSDT"];

// Logika screener Bitget — dipakai oleh cron DAN tombol Scan ulang di dashboard.
// Kriteria (sederhana & transparan):
//   1. Hanya pair /USDT spot di Bitget
//   2. Volume 24 jam minimal $2 juta (hindari coin low-liquidity)
//   3. Bukan stablecoin
//   4. Ranking momentum: |change 24h| tertinggi dengan volume besar
//   5. Simpan 10 teratas sebagai kandidat
export async function runScreener() {
  const tickers = await fetchAllTickers();

  const candidates = tickers
    .filter((t) => t.symbol.endsWith("USDT"))
    .filter((t) => !STABLE.includes(t.symbol))
    .map((t) => ({
      symbol: t.symbol,
      last_price: parseFloat(t.lastPr),
      change_24h: Math.round(parseFloat(t.change24h) * 10000) / 100, // ke persen
      quote_volume: parseFloat(t.usdtVolume || t.quoteVolume || 0),
    }))
    .filter((t) => t.quote_volume >= 2_000_000)
    .filter((t) => Math.abs(t.change_24h) >= 3)
    .sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h))
    .slice(0, 10)
    .map((t) => ({
      ...t,
      reason:
        (t.change_24h > 0 ? "Naik " : "Turun ") +
        Math.abs(t.change_24h).toFixed(1) +
        "% 24 jam · vol $" +
        (t.quote_volume / 1_000_000).toFixed(1) +
        "M",
    }));

  const supabase = createAdminClient();

  // Bersihkan hasil lama, simpan batch baru
  await supabase
    .from("screener_results")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (candidates.length > 0) {
    await supabase.from("screener_results").insert(candidates);
  }

  return candidates;
}
