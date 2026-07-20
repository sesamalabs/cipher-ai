// Memori trading: ringkasan histori untuk konteks analisa AI berikutnya
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function buildTradingMemory() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("signals")
    .select("result, tags, review, rr_achieved, symbol")
    .not("result", "is", null)
    .order("closed_at", { ascending: false })
    .limit(100);

  if (!data || data.length === 0) return "";

  const total = data.length;
  const wins = data.filter((r) => r.result === "win").length;
  const winrate = Math.round((wins / total) * 100);

  // Statistik per tag/pola
  const tagStats = {};
  for (const r of data) {
    if (!Array.isArray(r.tags)) continue;
    for (const tag of r.tags) {
      if (!tagStats[tag]) tagStats[tag] = { n: 0, win: 0 };
      tagStats[tag].n += 1;
      if (r.result === "win") tagStats[tag].win += 1;
    }
  }
  const tagLines = Object.entries(tagStats)
    .filter(([, s]) => s.n >= 2)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 8)
    .map(
      ([tag, s]) =>
        "- " + tag + ": " + s.win + "/" + s.n + " win (" + Math.round((s.win / s.n) * 100) + "%)"
    );

  // Pelajaran terakhir dari review AI
  const lessons = data
    .filter((r) => r.review)
    .slice(0, 5)
    .map((r) => "- [" + r.symbol + " " + (r.result === "win" ? "WIN" : "LOSS") + "] " + r.review);

  let text =
    "Total trade selesai: " + total + ", winrate keseluruhan: " + winrate + "%.";
  if (tagLines.length > 0) {
    text += "\nPerforma per pola:\n" + tagLines.join("\n");
  }
  if (lessons.length > 0) {
    text += "\nPelajaran dari trade terakhir:\n" + lessons.join("\n");
  }
  return text;
}
