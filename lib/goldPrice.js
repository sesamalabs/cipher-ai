// Data harga XAUUSD (gold spot) via endpoint chart Yahoo Finance.
//
// PENTING: sama seperti CryptoBubbles, ini endpoint backend TIDAK didokumentasikan resmi
// sebagai API publik — dipakai secara luas oleh komunitas developer dan terbukti stabil,
// tapi tidak ada jaminan Yahoo tidak akan mengubah/membatasinya sewaktu-waktu. Selalu
// dibungkus try/catch oleh pemanggilnya.
const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const SYMBOL = "XAUUSD=X";

async function fetchYahooChart(interval, range) {
  const url = YF_BASE + encodeURIComponent(SYMBOL) + "?interval=" + interval + "&range=" + range;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CipherGold/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Yahoo Finance API error: " + res.status);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo Finance: data XAUUSD tidak ditemukan");

  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    // lewati bar kosong (pasar forex tutup akhir pekan dsb.)
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ t: ts[i] * 1000, o, h, l, c, v: q.volume?.[i] || 0 });
  }
  return candles;
}

// Gabungkan tiap 4 candle 1 jam jadi 1 candle 4 jam (Yahoo tidak punya interval 4H native)
function aggregateTo4h(hourly) {
  const out = [];
  for (let i = 0; i < hourly.length; i += 4) {
    const chunk = hourly.slice(i, i + 4);
    if (chunk.length === 0) continue;
    out.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map((c) => c.h)),
      l: Math.min(...chunk.map((c) => c.l)),
      c: chunk[chunk.length - 1].c,
      v: chunk.reduce((s, c) => s + (c.v || 0), 0),
    });
  }
  return out;
}

// Ambil candle XAUUSD untuk timeframe tertentu, hasil ascending (lama -> baru)
export async function fetchGoldCandles(timeframe = "4H", limit = 200) {
  let candles;
  if (timeframe === "15m") {
    candles = await fetchYahooChart("15m", "5d");
  } else if (timeframe === "1H") {
    candles = await fetchYahooChart("60m", "1mo");
  } else if (timeframe === "4H") {
    const hourly = await fetchYahooChart("60m", "3mo");
    candles = aggregateTo4h(hourly);
  } else {
    candles = await fetchYahooChart("1d", "2y");
  }
  return candles.slice(-limit);
}

// Harga terkini XAUUSD (candle terakhir dari data 1 menit/harian terbaru)
export async function fetchGoldQuote() {
  const candles = await fetchYahooChart("1d", "5d");
  if (candles.length === 0) throw new Error("Harga XAUUSD tidak tersedia (pasar mungkin tutup)");
  return candles[candles.length - 1].c;
}
