import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { fetchAllTickers, tickersToPriceMap } from "@/lib/bitget";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/check-prices
// Dipanggil oleh Vercel Cron ATAU cron-job.org tiap 5 menit
// Auth: header Authorization: Bearer <CRON_SECRET>
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (auth !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: signals, error } = await supabase
    .from("signals")
    .select("*")
    .in("status", ["active", "tp1", "tp2"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!signals || signals.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, message: "Tidak ada sinyal aktif" });
  }

  const tickers = await fetchAllTickers();
  const prices = tickersToPriceMap(tickers);
  const now = new Date().toISOString();
  const results = [];

  for (const s of signals) {
    const price = prices[s.symbol];
    if (!price) {
      results.push({ symbol: s.symbol, note: "harga tidak ditemukan di Bitget" });
      continue;
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
      update.status = s.status; // status terakhir tetap
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

  return NextResponse.json({ ok: true, checked: signals.length, results });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
