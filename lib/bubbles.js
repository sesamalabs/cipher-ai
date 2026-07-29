// Sumber data screener eksternal: CryptoBubbles (cakupan pasar lebih luas — rank market cap,
// volume 24 jam global, performa harian) dibanding ticker Bitget saja.
//
// PENTING: ini endpoint backend publik milik cryptobubbles.net yang TIDAK didokumentasikan
// resmi sebagai API (tidak ada jaminan stabil, bisa berubah/diblokir sewaktu-waktu tanpa
// pemberitahuan). Karena itu selalu dibungkus try/catch di lib/screener.js dengan fallback
// ke ticker Bitget langsung kalau endpoint ini gagal.
const BUBBLES_URL = "https://cryptobubbles.net/backend/data/bubbles1000.usd.json";

export async function fetchBubbles() {
  const res = await fetch(BUBBLES_URL, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CipherScreener/1.0)" },
  });
  if (!res.ok) throw new Error("CryptoBubbles API error: " + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("CryptoBubbles: format data tidak sesuai");
  return data;
}
