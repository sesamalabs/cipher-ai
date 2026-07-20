-- ============================================================
-- CIPHER — Migrasi v4: memori trading (auto-review tiap trade)
-- Jalankan SEKALI di Supabase SQL Editor (paste semua, klik Run)
-- ============================================================

-- Catatan evaluasi AI setelah trade selesai (hit TP/SL)
alter table public.signals add column if not exists review text;
