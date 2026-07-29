// Analisa setup trading XAUUSD via Gemini dari data candle Yahoo Finance
import { fetchGoldCandles } from "@/lib/goldPrice";
import { ema, rsi, swingLevels } from "@/lib/candles";
import { callGemini } from "@/lib/analyze";

export async function analyzeGold(timeframe = "4H", memoryText = "") {
  const candles = await fetchGoldCandles(timeframe, 200);
  if (candles.length < 60) {
    return { ok: false, note: "Data candle XAUUSD tidak cukup (pasar forex mungkin sedang tutup)" };
  }

  const closes = candles.map((c) => c.c);
  const last = candles[candles.length - 1];
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const { support, resistance } = swingLevels(candles);
  const recent = candles.slice(-30).map((c) => ({ o: c.o, h: c.h, l: c.l, c: c.c }));

  let prompt =
    "Kamu CIPHER, analis price action XAUUSD (gold spot) yang disiplin dan jujur. " +
    "Gunakan kerangka price action klasik: rejection candle di level penting, CHOCH (Change of Character — " +
    "pergantian struktur dari bullish ke bearish atau sebaliknya), break/retest trendline, dan support/resistance. " +
    "Berdasarkan HANYA data berikut, tentukan apakah ada setup LONG yang layak di XAUUSD timeframe " +
    timeframe +
    ".\n\n" +
    "Harga terakhir: " +
    last.c +
    "\nRSI(14): " +
    (rsi14 ? rsi14.toFixed(1) : "-") +
    "\nEMA20: " +
    (ema20 ? ema20.toFixed(2) : "-") +
    "\nEMA50: " +
    (ema50 ? ema50.toFixed(2) : "-") +
    "\nSupport (swing lows): " +
    support.map((x) => +x.toFixed(2)).join(", ") +
    "\nResistance (swing highs): " +
    resistance.map((x) => +x.toFixed(2)).join(", ") +
    "\n30 candle terakhir (OHLC): " +
    JSON.stringify(recent);

  if (memoryText) {
    prompt +=
      "\n\nMEMORI TRADING XAUUSD HISTORIS (hasil nyata sistem ini — pelajari dan terapkan):\n" +
      memoryText +
      "\nGunakan memori ini: prioritaskan pola dengan winrate historis baik, hindari atau perketat syarat untuk pola yang sering gagal.";
  }

  prompt +=
    "\n\nAturan wajib:\n" +
    "- Hanya setup LONG (beli). Tidak ada short.\n" +
    "- stop_loss < entry < tp1 < tp2 < tp3, dalam satuan harga USD per troy ounce (format XAUUSD normal, contoh 2385.50).\n" +
    "- SL harus di bawah support/level rejection terdekat yang masuk akal, bukan angka asal.\n" +
    "- Risk-reward ke tp3 minimal 1:3. Kalau tidak tercapai secara wajar, setup_layak = false.\n" +
    "- Entry harus realistis: dekat harga sekarang atau di area retest/rejection yang jelas.\n" +
    "- Kalau kondisi tidak mendukung (tidak ada CHOCH jelas, rejection lemah, struktur choppy), " +
    "jawab setup_layak = false. JANGAN memaksakan setup.\n" +
    "- reasoning maksimal 2 kalimat, bahasa Indonesia, sebutkan konsep price action yang benar-benar dipakai " +
    "(mis. rejection di resistance, CHOCH bearish->bullish, retest trendline).\n" +
    '- tags: 1-3 tag pola dalam kebab-case, mis. "rejection-resistance", "choch-bullish", "trendline-retest", "support-bounce".\n\n' +
    "Jawab HANYA JSON valid persis bentuk ini tanpa teks lain:\n" +
    '{"setup_layak": true/false, "entry": angka, "stop_loss": angka, "tp1": angka, "tp2": angka, "tp3": angka, "reasoning": "...", "tags": ["..."], "catatan_jika_tidak_layak": "..."}';

  const ai = await callGemini(prompt);
  if (!ai.ok) return { ok: false, note: ai.note };

  let parsed;
  try {
    parsed = JSON.parse(ai.text.replace(/```json|```/g, "").trim());
  } catch {
    return { ok: false, note: "Jawaban AI tidak bisa diparse" };
  }

  if (!parsed.setup_layak) {
    return {
      ok: true,
      setup: false,
      note: parsed.catatan_jika_tidak_layak || "Tidak ada setup layak saat ini",
    };
  }

  const { entry, stop_loss, tp1, tp2, tp3 } = parsed;
  const nums = [entry, stop_loss, tp1, tp2, tp3].map(Number);
  if (nums.some((n) => !isFinite(n) || n <= 0)) {
    return { ok: false, note: "Level dari AI tidak valid" };
  }
  if (!(stop_loss < entry && entry < tp1 && tp1 < tp2 && tp2 < tp3)) {
    return { ok: false, note: "Urutan level dari AI tidak logis, coba analisa ulang" };
  }
  const rr = (tp3 - entry) / (entry - stop_loss);
  if (rr < 2) {
    return { ok: true, setup: false, note: "RR terlalu kecil (1:" + rr.toFixed(1) + "), setup dilewati" };
  }
  if (Math.abs(entry - last.c) / last.c > 0.02) {
    return { ok: true, setup: false, note: "Entry AI terlalu jauh dari harga sekarang, setup dilewati" };
  }

  return {
    ok: true,
    setup: true,
    data: {
      entry: Number(entry),
      stop_loss: Number(stop_loss),
      tp1: Number(tp1),
      tp2: Number(tp2),
      tp3: Number(tp3),
      reasoning: String(parsed.reasoning || "").slice(0, 500),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      ohlcv: candles.slice(-120).map((c) => [c.t, c.o, c.h, c.l, c.c]),
      last_price: last.c,
    },
  };
}
