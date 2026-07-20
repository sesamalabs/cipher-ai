// Analisa setup trading via Gemini dari data OHLCV Bitget
import { fetchCandles, ema, rsi, swingLevels } from "@/lib/candles";

// Urutan model yang dicoba — kalau satu ditolak (404/deprecated), lanjut ke berikutnya
const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
];

function geminiUrl(model) {
  return (
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    model +
    ":generateContent"
  );
}

export async function callGemini(prompt) {
  let lastErr = "";
  for (const model of GEMINI_MODELS) {
    const res = await fetch(geminiUrl(model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { ok: true, text, model };
    }

    const t = await res.text();
    lastErr = "Model " + model + " -> " + res.status + ": " + t.slice(0, 150);
    // 404 / model tidak tersedia -> coba model berikutnya; error lain -> berhenti
    if (res.status !== 404) {
      return { ok: false, note: "Gemini error: " + lastErr };
    }
  }
  return { ok: false, note: "Semua model Gemini ditolak. Terakhir: " + lastErr };
}

export async function analyzeSymbol(symbol, timeframe = "4H", memoryText = "") {
  const candles = await fetchCandles(symbol, timeframe, 200);
  if (candles.length < 60) {
    return { ok: false, note: "Data candle tidak cukup untuk " + symbol };
  }

  const closes = candles.map((c) => c.c);
  const last = candles[candles.length - 1];
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const { support, resistance } = swingLevels(candles);
  const recent = candles.slice(-30).map((c) => ({
    o: c.o,
    h: c.h,
    l: c.l,
    c: c.c,
  }));

  let prompt =
    "Kamu CIPHER, analis teknikal crypto pribadi yang disiplin, jujur, dan terus belajar dari histori trading pemilikmu. " +
    "Berdasarkan HANYA data berikut, tentukan apakah ada setup LONG spot yang layak di " +
    symbol +
    " timeframe " +
    timeframe +
    ".\n\n" +
    "Harga terakhir: " +
    last.c +
    "\nRSI(14): " +
    (rsi14 ? rsi14.toFixed(1) : "-") +
    "\nEMA20: " +
    (ema20 ? ema20.toFixed(6) : "-") +
    "\nEMA50: " +
    (ema50 ? ema50.toFixed(6) : "-") +
    "\nSupport (swing lows): " +
    support.map((x) => +x.toPrecision(6)).join(", ") +
    "\nResistance (swing highs): " +
    resistance.map((x) => +x.toPrecision(6)).join(", ") +
    "\n30 candle terakhir (OHLC): " +
    JSON.stringify(recent);

  if (memoryText) {
    prompt +=
      "\n\nMEMORI TRADING HISTORIS (hasil nyata sistem ini — pelajari dan terapkan):\n" +
      memoryText +
      "\nGunakan memori ini: prioritaskan pola dengan winrate historis baik, hindari atau perketat syarat untuk pola yang sering gagal, dan terapkan pelajaran dari trade terakhir.";
  }

  prompt +=
    "\n\nAturan wajib:\n" +
    "- Hanya setup LONG (beli spot). Tidak ada short.\n" +
    "- stop_loss < entry < tp1 < tp2 < tp3.\n" +
    "- SL harus di bawah support terdekat yang masuk akal, bukan angka asal.\n" +
    "- Risk-reward ke tp3 minimal 1:3. Kalau tidak tercapai secara wajar, setup_layak = false.\n" +
    "- Entry harus realistis: dekat harga sekarang atau di area retest yang jelas.\n" +
    "- Kalau kondisi tidak mendukung (downtrend kuat, RSI netral tanpa struktur, dsb), " +
    "jawab setup_layak = false. JANGAN memaksakan setup.\n" +
    "- reasoning maksimal 2 kalimat, bahasa Indonesia, sebut level/indikator yang benar-benar dipakai. " +
    "Kalau memori historis memengaruhi keputusanmu, sebut singkat.\n" +
    '- tags: 1-3 tag pola dalam kebab-case, mis. "support-bounce", "breakout-retest", "rsi-oversold". ' +
    "Pakai nama tag yang KONSISTEN dengan memori historis bila polanya sama.\n\n" +
    "Jawab HANYA JSON valid persis bentuk ini tanpa teks lain:\n" +
    '{"setup_layak": true/false, "entry": angka, "stop_loss": angka, "tp1": angka, "tp2": angka, "tp3": angka, "reasoning": "...", "tags": ["..."], "catatan_jika_tidak_layak": "..."}';

  const ai = await callGemini(prompt);
  if (!ai.ok) {
    return { ok: false, note: ai.note };
  }

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
    return { ok: false, note: "Urutan level dari AI tidak logis, coba scan ulang" };
  }
  const rr = (tp3 - entry) / (entry - stop_loss);
  if (rr < 2) {
    return { ok: true, setup: false, note: "RR terlalu kecil (1:" + rr.toFixed(1) + "), setup dilewati" };
  }
  // Entry tidak boleh terlalu jauh dari harga sekarang (maks 15%)
  if (Math.abs(entry - last.c) / last.c > 0.15) {
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
