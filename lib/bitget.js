// Helper Bitget public API (spot) — tidak butuh API key
const BASE = "https://api.bitget.com";

// Ambil semua ticker spot sekaligus (1 request untuk semua pair)
export async function fetchAllTickers() {
  const res = await fetch(BASE + "/api/v2/spot/market/tickers", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Bitget API error: " + res.status);
  const json = await res.json();
  if (json.code !== "00000") throw new Error("Bitget: " + json.msg);
  return json.data; // array of { symbol, lastPr, change24h, quoteVolume, ... }
}

// Buat map { SOLUSDT: 142.5, ... } untuk lookup harga cepat
export function tickersToPriceMap(tickers) {
  const map = {};
  for (const t of tickers) {
    map[t.symbol] = parseFloat(t.lastPr);
  }
  return map;
}
