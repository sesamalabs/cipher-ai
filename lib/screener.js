import { createAdminClient } from "@/lib/supabaseAdmin";
import { fetchAllTickers } from "@/lib/bitget";
import { fetchBubbles } from "@/lib/bubbles";

// Pengaturan screener — mengacu ke 5 kategori rank market cap CryptoBubbles
// (1-100, 101-200, 201-300, 301-400, 401-500), diambil beberapa kandidat TERBAIK
// dari TIAP kategori, bukan digabung rata lalu diambil top-nya saja — supaya coin
// besar (rank 1-100, volume selalu tinggi) tidak mendominasi semua slot dan
// kategori mid/small-cap tetap kebagian tempat.
const RANK_BUCKETS = [
  [1, 100],
  [101, 200],
  [201, 300],
  [301, 400],
  [401, 500],
];
const PER_BUCKET = 2; // kandidat terbaik yang diambil dari tiap kategori
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

  const eligible = coins
    .filter((c) => !c.stable)
    .filter((c) => c.symbols && c.symbols.bitget) // wajib bisa dieksekusi di Bitget
    .filter((c) => typeof c.rank === "number" && c.rank >= 1 && c.rank <= 500)
    .filter((c) => typeof c.volume === "number" && c.volume >= MIN_VOLUME)
    .filter(
      (c) =>
        c.performance &&
        typeof c.performance.day === "number" &&
        Math.abs(c.performance.day) >= MIN_ABS_CHANGE
    );

  const picked = [];
  for (const [min, max] of RANK_BUCKETS) {
    const bucketBest = eligible
      .filter((c) => c.rank >= min && c.rank <= max)
      .sort((a, b) => Math.abs(b.performance.day) - Math.abs(a.performance.day))
      .slice(0, PER_BUCKET);
    picked.push(...bucketBest);
  }

  return picked.map((c) => {
    const change = Math.round(c.performance.day * 100) / 100;
    const price = (c.exchangePrices && c.exchangePrices.bitget) || c.price;
    return {
      symbol: c.symbols.bitget,
      last_price: price,
      change_24h: change,
      quote_volume: c.volume,
      rank: c.rank,
      reason:
        (change > 0 ? "Naik " : "Turun ") +
        Math.abs(change).toFixed(1) +
        "% 24 jam · vol $" +
        (c.volume / 1_000_000).toFixed(1) +
        "M · rank #" +
        c.rank,
    };
  });
}

// Fallback: langsung dari ticker Bitget kalau CryptoBubbles gagal diakses
// (tidak ada data rank market cap di sini, jadi tidak dibagi per kategori)
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
    .slice(0, RANK_BUCKETS.length * PER_BUCKET)
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
