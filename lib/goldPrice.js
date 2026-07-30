// Data harga XAUUSD (gold spot) via Twelve Data — API resmi & terdokumentasi,
// melacak XAU/USD gaya forex (mendekati feed OANDA/broker retail seperti di TradingView),
// BUKAN futures COMEX (GC=F) yang harganya bisa cukup berbeda dari harga spot sungguhan.
//
// Butuh API key gratis dari https://twelvedata.com (daftar -> Dashboard -> API Key),
// disimpan sebagai environment variable TWELVEDATA_API_KEY di Vercel.
const TD_BASE = "https://api.twelvedata.com";
const SYMBOL = "XAU/USD";

const INTERVAL_MAP = {
  "15m": "15min",
  "1H": "1h",
  "4H": "4h",
  "1D": "1day",
};

function requireApiKey() {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) {
    throw new Error(
      "TWELVEDATA_API_KEY belum diisi di environment Vercel — daftar gratis di twelvedata.com untuk dapat API key"
    );
  }
  return key;
}

// Ambil candle XAUUSD untuk timeframe tertentu, hasil ascending (lama -> baru)
export async function fetchGoldCandles(timeframe = "4H", limit = 200) {
  const apiKey = requireApiKey();
  const interval = INTERVAL_MAP[timeframe] || "4h";
  const url =
    TD_BASE +
    "/time_series?symbol=" +
    encodeURIComponent(SYMBOL) +
    "&interval=" +
    interval +
    "&outputsize=" +
    limit +
    "&apikey=" +
    apiKey;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (json.status === "error" || json.code) {
    throw new Error("Twelve Data: " + (json.message || "gagal ambil data XAUUSD"));
  }
  if (!Array.isArray(json.values)) {
    throw new Error("Twelve Data: format data XAUUSD tidak sesuai");
  }

  // Twelve Data mengembalikan data terbaru duluan (descending) -> balik jadi ascending
  const candles = json.values
    .map((v) => ({
      t: new Date(v.datetime.replace(" ", "T") + "Z").getTime(),
      o: parseFloat(v.open),
      h: parseFloat(v.high),
      l: parseFloat(v.low),
      c: parseFloat(v.close),
      v: parseFloat(v.volume || 0),
    }))
    .reverse();

  return candles;
}

// Harga terkini XAUUSD (endpoint real-time price Twelve Data)
export async function fetchGoldQuote() {
  const apiKey = requireApiKey();
  const url = TD_BASE + "/price?symbol=" + encodeURIComponent(SYMBOL) + "&apikey=" + apiKey;
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (json.status === "error" || json.code || !json.price) {
    throw new Error("Twelve Data: " + (json.message || "harga XAUUSD tidak tersedia"));
  }
  return parseFloat(json.price);
}
