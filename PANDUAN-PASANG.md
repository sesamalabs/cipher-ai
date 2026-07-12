# PANDUAN PASANG CIPHER

Semua langkah lewat browser, tanpa ngetik kode. Ikuti urut dari atas.

---
 
## LANGKAH 1 — Supabase (± 5 menit)

1. Buka https://supabase.com/dashboard → klik **New Project**
2. Nama project: `cipher` (atau bebas), buat password database, pilih region **Southeast Asia (Singapore)**
3. Tunggu project selesai dibuat (± 2 menit)
4. Buka menu **SQL Editor** (ikon terminal di sidebar kiri)
5. Buka file `supabase/migration.sql` dari project ini → copy SEMUA isinya → paste ke SQL Editor → klik **Run**
6. Kalau muncul "Success. No rows returned" → berhasil

### Buat akun login kamu:
7. Buka menu **Authentication** → tab **Users** → klik **Add user** → **Create new user**
8. Isi email & password kamu (ini yang dipakai login ke dashboard nanti) → klik **Create user**

### Catat 3 kunci ini (dipakai di Langkah 3):
9. Buka **Project Settings** (ikon gear) → **API**
   - `Project URL` → ini untuk `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → ini untuk `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (klik Reveal) → ini untuk `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ service_role JANGAN pernah dibagikan / dipaste di tempat publik

---

## LANGKAH 2 — GitHub (± 3 menit)

1. Buka https://github.com/new → nama repo: `cipher` → pilih **Private** → **Create repository**
2. Di halaman repo kosong, klik link **uploading an existing file**
3. Drag & drop SEMUA isi folder project ini (folder `app`, `lib`, `supabase`, dan semua file di root: `package.json`, `next.config.js`, `jsconfig.json`, `vercel.json`, `middleware.js`, `.env.example`, `PANDUAN-PASANG.md`)
   - Catatan: GitHub web tidak bisa upload folder kosong, tapi folder berisi file akan ikut terupload dengan struktur yang benar. Kalau drag folder tidak jalan di browser kamu, zip dulu lalu pakai cara commit per-folder, atau upload dari GitHub Desktop.
4. Tulis commit message bebas → klik **Commit changes**

---

## LANGKAH 3 — Vercel (± 5 menit)

1. Buka https://vercel.com/new → pilih repo `cipher` → klik **Import**
2. Di bagian **Environment Variables**, tambahkan 5 baris ini satu per satu:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | (Project URL dari Langkah 1) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key dari Langkah 1) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (service_role key dari Langkah 1) |
   | `CIPHER_API_KEY` | (buat sendiri: string acak panjang, contoh hasil dari passwordsgenerator) |
   | `CRON_SECRET` | (buat sendiri juga, string acak yang BEDA) |

3. Klik **Deploy** → tunggu ± 2 menit
4. Buka URL vercel yang muncul → harusnya diarahkan ke halaman login → coba login pakai email/password dari Langkah 1
5. **Domain sendiri**: Settings → Domains → Add → masukkan domainmu → ikuti instruksi DNS seperti biasa

---

## LANGKAH 4 — Cron pengecekan harga tiap 5 menit (± 5 menit)

Vercel plan gratis (Hobby) hanya mengizinkan cron 1x per hari. Supaya pengecekan
TP/SL jalan tiap 5 menit, kita pakai layanan gratis cron-job.org:

1. Daftar di https://cron-job.org (gratis)
2. Klik **Create cronjob**:
   - Title: `CIPHER price check`
   - URL: `https://DOMAIN-KAMU/api/cron/check-prices`
   - Schedule: **Every 5 minutes**
3. Buka tab **Advanced** → bagian **Headers** → tambah:
   - Key: `Authorization`
   - Value: `Bearer ISI-DENGAN-CRON_SECRET-KAMU`
4. Save. Buat satu cronjob lagi untuk screener:
   - Title: `CIPHER screener`
   - URL: `https://DOMAIN-KAMU/api/cron/screener`
   - Schedule: **Every 30 minutes** (atau 1 jam, bebas)
   - Header Authorization sama seperti di atas
5. Klik tombol **Test run** di masing-masing job → kalau respon `{"ok":true,...}` berarti jalan

---

## LANGKAH 5 — Sambungkan Claude Code (mesin analisa)

Supaya Claude Code di laptop bisa mengirim draft sinyal ke dashboard,
cukup kasih tahu Claude Code cara pakainya. Simpan prompt ini
(bisa ditaruh di file CLAUDE.md dalam folder tradingview-mcp):

```
Ketika saya minta buat sinyal trading, setelah analisa chart selesai,
kirim draft sinyal ke dashboard CIPHER dengan HTTP POST:

URL: https://DOMAIN-KAMU/api/signals
Header: x-api-key: ISI-DENGAN-CIPHER_API_KEY
Body JSON:
{
  "symbol": "SOLUSDT",
  "timeframe": "4H",
  "entry": 142.5,
  "stop_loss": 138.0,
  "tp1": 148.0,
  "tp2": 153.0,
  "tp3": 158.0,
  "risk_pct": 3,
  "reasoning": "alasan entry singkat",
  "tags": ["bullish-engulfing", "support-bounce"]
}

Gunakan curl atau fetch. Kalau respon 201, bilang "draft terkirim,
cek dashboard untuk konfirmasi".
```

Alur harian kamu jadi:
1. Buka TradingView Desktop (mode debug) + Claude Code
2. Minta Claude analisa kandidat dari screener → Claude kirim draft
3. Buka dashboard di HP/laptop → Setujui / Tolak
4. Sistem mantau otomatis sampai TP/SL → hasil masuk histori & winrate

---

## Kalau ada masalah

- **Login gagal terus** → cek user sudah dibuat di Supabase Authentication → Users
- **Dashboard kosong/error** → cek 5 environment variable di Vercel, lalu redeploy
- **Cron test gagal 401** → header Authorization salah; pastikan formatnya `Bearer xxx` (pakai kata Bearer dan spasi)
- **Screener kosong** → jalankan Test run cronjob screener dulu sekali
- **Harga tidak update** → cek cronjob check-prices di cron-job.org statusnya hijau

---

⚠️ **Pengingat penting**: sistem ini alat bantu analisa dan pencatatan —
bukan jaminan profit. Winrate yang tampil adalah data historis kamu sendiri,
bukan prediksi hasil ke depan. Selalu pakai uang dingin dan batasi risiko
per transaksi (2-5% sesuai pengaturan risk_pct).
