-- ============================================================
-- CIPHER — Migrasi v6: dukungan multi-aset (persiapan XAUUSD)
-- Sudah dijalankan langsung via integrasi Supabase MCP.
-- Disimpan di sini untuk dokumentasi/riwayat saja.
-- ============================================================

alter table public.signals add column if not exists asset_class text default 'crypto';
update public.signals set asset_class = 'crypto' where asset_class is null;
