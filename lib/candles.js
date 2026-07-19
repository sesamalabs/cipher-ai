// Helper data candlestick Bitget + perhitungan indikator dasar
const BASE = "https://api.bitget.com";

const GRANULARITY = {
  "15m": "15min",
  "1H": "1h",
  "4H": "4h",
  "1D": "1day",
};

// Ambil candle spot Bitget. Return array ascending (lama -> baru):
// [{ t, o, h, l, c, v }]
export async function fetchCandles(symbol, timeframe = "4H", limit = 200) {
  const gran = GRANULARITY[timeframe] || "4h";
  const url =
    BASE +
    "/api/v2/spot/market/candles?symbol=" +
    encodeURIComponent(symbol) +
    "&granularity=" +
    gran +
    "&limit=" +
    limit;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Bitget candles error: " + res.status);
  const json = await res.json();
  if (json.code !== "00000") throw new Error("Bitget: " + json.msg);

  const rows = (json.data || []).map((r) => ({
    t: parseInt(r[0]),
    o: parseFloat(r[1]),
    h: parseFloat(r[2]),
    l: parseFloat(r[3]),
    c: parseFloat(r[4]),
    v: parseFloat(r[5]),
  }));
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
  }
  return e;
}

export function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Swing high/low sederhana untuk level support/resistance
export function swingLevels(candles, lookback = 3, max = 6) {
  const highs = [];
  const lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].h <= candles[i - j].h || candles[i].h <= candles[i + j].h)
        isHigh = false;
      if (candles[i].l >= candles[i - j].l || candles[i].l >= candles[i + j].l)
        isLow = false;
    }
    if (isHigh) highs.push(candles[i].h);
    if (isLow) lows.push(candles[i].l);
  }
  return {
    resistance: highs.slice(-max),
    support: lows.slice(-max),
  };
}
