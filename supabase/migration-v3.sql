-- ============================================================
-- CIPHER — Migrasi v3: setup dari web (tanpa TradingView)
-- Jalankan SEKALI di Supabase SQL Editor (paste semua, klik Run)
-- ============================================================

-- Sumber sinyal: 'manual' (Claude Code + TradingView) atau 'web' (Gemini dari dashboard)
alter table public.signals add column if not exists source text default 'manual';

-- Data candlestick (OHLCV) yang dipakai saat analisa, untuk menggambar chart di dashboard
alter table public.signals add column if not exists ohlcv jsonb;
