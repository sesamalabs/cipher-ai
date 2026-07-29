-- ============================================================
-- CIPHER — Migrasi v5: kolom rank market cap di hasil screener
-- Jalankan SEKALI di Supabase SQL Editor (paste semua, klik Run)
-- ============================================================

alter table public.screener_results add column if not exists rank integer;
