import { createAdminClient } from "@/lib/supabaseAdmin";
import { fetchAllTickers } from "@/lib/bitget";
import { fetchBubbles } from "@/lib/bubbles";

// Pengaturan screener — meniru settingan CryptoBubbles "Vol & MC" yang dipakai user:
// rank market cap 301-400 (mid-cap, hindari top coin & micro-cap ekstrem), periode Day.
const RANK_MIN = 301;
const RANK_MAX = 400;
const MIN_VOLUME = 2_000_000; // USD, volume 24 jam global minimum (hindari coin low-liquidity)
const MIN_ABS_CHANGE = 3; // persen, minimal pergerakan 24 jam biar bukan coin yang diam saja

// Logika screener — dipakai oleh cron DAN tombol "Scan ulang" di dashboard.
// Sumber utama: CryptoBubbles (rank + volume global + performa harian), difilter hanya
// coin yang benar-benar listing di Bitget (via field symbols.bitget), harga eksekusi
// diambil dari exchangePrices.bitget kalau tersedia (harga spesifik Bitget, bukan rata-rata
// global). Kalau sumber ini gagal diakses, otomatis jatuh ke ticker Bitget langsung.
export async function runScreener() {
  let candidates;
  let source = "cryptobubbles";
  try {
    candidates = await screenFromBubbles();
  } catch {
    source = "bitget-fallback";
    candidates = await screenFromBitget();
  }

  const supabase = createAdminClient();

  // Bersihkan hasil lama, simpan batch baru
  await supabase
    .from("screener_results")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (candidates.length > 0) {
    await supabase.from("screener_results").insert(candidates);
  }

  return { candidates, source };
}

async function screenFromBubbles() {
  const coins = await fetchBubbles();

  return coins
    .filter((c) => !c.stable)
    .filter((c) => c.symbols && c.symbols.bitget) // wajib bisa dieksekusi di Bitget
    .filter((c) => typeof c.rank === "number" && c.rank >= RANK_MIN && c.rank <= RANK_MAX)
    .filter((c) => typeof c.volume === "number" && c.volume >= MIN_VOLUME)
    .filter(
      (c) =>
        c.performance &&
        typeof c.performance.day === "number" &&
        Math.abs(c.performance.day) >= MIN_ABS_CHANGE
    )
    .map((c) => {
      const change = Math.round(c.performance.day * 100) / 100;
      const price = (c.exchangePrices && c.exchangePrices.bitget) || c.price;
      return {
        symbol: c.symbols.bitget,
        last_price: price,
        change_24h: change,
        quote_volume: c.volume,
        reason:
          (change > 0 ? "Naik " : "Turun ") +
          Math.abs(change).toFixed(1) +
          "% 24 jam · vol $" +
          (c.volume / 1_000_000).toFixed(1) +
          "M · rank #" +
          c.rank,
      };
    })
    .sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h))
    .slice(0, 10);
}

// Fallback: langsung dari ticker Bitget kalau CryptoBubbles gagal diakses
const STABLE = ["USDCUSDT", "DAIUSDT", "TUSDUSDT", "FDUSDUSDT", "USDPUSDT", "EURUSDT"];

async function screenFromBitget() {
  const tickers = await fetchAllTickers();

  return tickers
    .filter((t) => t.symbol.endsWith("USDT"))
    .filter((t) => !STABLE.includes(t.symbol))
    .map((t) => ({
      symbol: t.symbol,
      last_price: parseFloat(t.lastPr),
      change_24h: Math.round(parseFloat(t.change24h) * 10000) / 100,
      quote_volume: parseFloat(t.usdtVolume || t.quoteVolume || 0),
    }))
    .filter((t) => t.quote_volume >= MIN_VOLUME)
    .filter((t) => Math.abs(t.change_24h) >= MIN_ABS_CHANGE)
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
}
