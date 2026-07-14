-- ============================================================
-- CIPHER — Migrasi v2: screenshot setup chart
-- Jalankan SEKALI di Supabase SQL Editor (paste semua, klik Run)
-- ============================================================

-- Kolom URL screenshot di tabel signals
alter table public.signals add column if not exists chart_url text;

-- Bucket penyimpanan screenshot (publik agar bisa tampil di dashboard)
insert into storage.buckets (id, name, public)
values ('charts', 'charts', true)
on conflict (id) do nothing;

-- Izin baca publik untuk bucket charts
drop policy if exists "charts publik boleh baca" on storage.objects;
create policy "charts publik boleh baca"
  on storage.objects for select
  to public
  using (bucket_id = 'charts');
