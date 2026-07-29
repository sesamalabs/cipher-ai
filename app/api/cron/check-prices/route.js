import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkPrices } from "@/lib/priceCheck";
import { callGemini } from "@/lib/analyze";

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
  const { checked, results } = await checkPrices(supabase);

  // --- Memori trading: auto-review trade yang baru selesai (maks 2 per run) ---
  let reviewed = 0;
  if (process.env.GEMINI_API_KEY) {
    try {
      const { data: toReview } = await supabase
        .from("signals")
        .select("*")
        .not("result", "is", null)
        .is("review", null)
        .order("closed_at", { ascending: true })
        .limit(2);

      for (const s of toReview || []) {
        const prompt =
          "Kamu CIPHER, analis trading yang mengevaluasi hasil trade-nya sendiri untuk terus belajar.\n\n" +
          "Trade selesai:\n" +
          "- Pair: " + s.symbol + " (" + s.timeframe + ", long spot)\n" +
          "- Entry: " + s.entry + ", SL: " + s.stop_loss +
          ", TP1: " + s.tp1 + ", TP2: " + s.tp2 + ", TP3: " + s.tp3 + "\n" +
          "- Hasil: " + (s.result === "win" ? "WIN" : "LOSS") +
          " (status akhir: " + s.status + ", RR tercapai: " + (s.rr_achieved ?? "-") + ")\n" +
          "- Reasoning saat entry: " + (s.reasoning || "-") + "\n" +
          "- Tags pola: " + (Array.isArray(s.tags) ? s.tags.join(", ") : "-") + "\n\n" +
          "Tulis evaluasi jujur maksimal 2 kalimat bahasa Indonesia: " +
          "(1) kenapa trade ini kemungkinan " + (s.result === "win" ? "berhasil" : "gagal") +
          " berdasarkan setup-nya, (2) SATU pelajaran konkret dan spesifik untuk memperbaiki setup berikutnya " +
          "(bukan nasihat umum). Jangan menyalahkan market; fokus pada apa yang bisa diperbaiki dari sisi setup.\n\n" +
          'Jawab HANYA JSON valid: {"review": "..."}';

        const ai = await callGemini(prompt);
        if (!ai.ok) break;

        let review = "";
        try {
          const parsed = JSON.parse(ai.text.replace(/```json|```/g, "").trim());
          review = String(parsed.review || "").slice(0, 400);
        } catch {
          continue;
        }
        if (review) {
          await supabase.from("signals").update({ review }).eq("id", s.id);
          reviewed += 1;
        }
      }
    } catch {
      // review adalah proses sekunder — jangan pernah menggagalkan pengecekan harga
    }
  }

  return NextResponse.json({ ok: true, checked, reviewed, results });
}
