-- ============================================================
-- CIPHER — Migrasi v7: pisahkan statistik crypto dari gold
-- Sudah dijalankan langsung via integrasi Supabase MCP.
-- Disimpan di sini untuk dokumentasi/riwayat saja.
-- ============================================================

-- view signal_stats dipakai Dashboard crypto — harus difilter asset_class,
-- kalau tidak, sinyal XAUUSD ikut tercampur ke winrate/statistik crypto.
create or replace view public.signal_stats as
select
  count(*) filter (where status in ('active','tp1','tp2'))          as active_count,
  count(*) filter (where status = 'draft')                          as draft_count,
  count(*) filter (where result is not null)                        as closed_count,
  count(*) filter (where result = 'win')                            as win_count,
  round(
    100.0 * count(*) filter (where result = 'win')
    / nullif(count(*) filter (where result is not null), 0)
  , 1)                                                              as winrate_pct,
  round(avg(rr_achieved) filter (where result = 'win'), 2)          as avg_rr
from public.signals
where asset_class = 'crypto';

grant select on public.signal_stats to authenticated;
