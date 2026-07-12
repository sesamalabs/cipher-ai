-- ============================================================
-- CIPHER — Skema Database
-- Jalankan SEKALI di Supabase SQL Editor (paste semua, klik Run)
-- ============================================================

-- Tabel utama: semua sinyal trading
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  symbol text not null,                  -- contoh: SOLUSDT
  timeframe text not null default '4H',  -- 15m / 1H / 4H / 1D
  direction text not null default 'long',
  entry numeric not null,
  stop_loss numeric not null,
  tp1 numeric not null,
  tp2 numeric,
  tp3 numeric,
  risk_pct numeric default 3,            -- % risiko modal
  reasoning text,                        -- alasan entry (kalimat)
  tags jsonb default '[]'::jsonb,        -- tag terstruktur: ["bullish-engulfing","support-bounce"]
  status text not null default 'draft',  -- draft / active / tp1 / tp2 / tp3 / sl / rejected
  result text,                           -- win / loss (diisi saat closed)
  rr_achieved numeric,                   -- RR aktual saat closed
  current_price numeric,
  approved_at timestamptz,
  closed_at timestamptz,
  last_checked_at timestamptz
);

-- Hasil screener Bitget (di-refresh oleh cron)
create table if not exists public.screener_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  last_price numeric,
  change_24h numeric,          -- dalam persen
  quote_volume numeric,        -- volume 24 jam dalam USDT
  reason text                  -- alasan lolos screening
);

-- Index untuk query cepat
create index if not exists idx_signals_status on public.signals (status);
create index if not exists idx_signals_created on public.signals (created_at desc);
create index if not exists idx_screener_created on public.screener_results (created_at desc);

-- ============================================================
-- Row Level Security
-- Dashboard (user login) boleh baca & update.
-- Insert hanya lewat API server (service role), bukan dari browser.
-- ============================================================
alter table public.signals enable row level security;
alter table public.screener_results enable row level security;

create policy "signals: user login boleh baca"
  on public.signals for select
  to authenticated
  using (true);

create policy "signals: user login boleh update"
  on public.signals for update
  to authenticated
  using (true)
  with check (true);

create policy "screener: user login boleh baca"
  on public.screener_results for select
  to authenticated
  using (true);

-- ============================================================
-- View statistik ringkas untuk dashboard
-- ============================================================
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
from public.signals;

grant select on public.signal_stats to authenticated;
