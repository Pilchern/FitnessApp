-- Overnight heart rate, HRV, breathing rate and SpO2 points from Health Auto
-- Export, kept so last night's averages can be taken over the time actually
-- asleep (bedtime to wake on recovery_checkins) instead of a fixed
-- 23:00-05:59 window. The two automations (sleep, hourly vitals) arrive in
-- either order; whichever lands second recomputes from what is stored.
--
-- sample_local is the phone's wall-clock time, matching bedtime_local and
-- wake_time_local. bucket_minutes is 60 for an hourly average and 0 for a
-- single reading. Upserted on (user_id, metric, sample_local,
-- bucket_minutes), so a resend of the same hour replaces it.
create table if not exists public.overnight_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  sample_local timestamp not null,
  bucket_minutes smallint not null default 0,
  value numeric(6, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint overnight_samples_metric_check
    check (metric in ('hrv', 'heart_rate', 'respiratory_rate', 'spo2')),
  constraint overnight_samples_bucket_check
    check (bucket_minutes in (0, 60)),
  constraint overnight_samples_unique
    unique (user_id, metric, sample_local, bucket_minutes)
);

drop trigger if exists set_overnight_samples_updated_at
  on public.overnight_samples;
create trigger set_overnight_samples_updated_at
before update on public.overnight_samples
for each row
execute function public.set_updated_at();

create index if not exists overnight_samples_user_time_idx
  on public.overnight_samples (user_id, sample_local)
  where deleted_at is null;

grant select, insert, update on public.overnight_samples to authenticated;

alter table public.overnight_samples enable row level security;

drop policy if exists "overnight_samples_select_own" on public.overnight_samples;
create policy "overnight_samples_select_own"
  on public.overnight_samples
  for select
  to authenticated
  using (public.owns_row(user_id));

drop policy if exists "overnight_samples_insert_own" on public.overnight_samples;
create policy "overnight_samples_insert_own"
  on public.overnight_samples
  for insert
  to authenticated
  with check (public.owns_row(user_id));

drop policy if exists "overnight_samples_update_own" on public.overnight_samples;
create policy "overnight_samples_update_own"
  on public.overnight_samples
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

-- Which window last night's sleep_* vitals were averaged over: 'sleep'
-- (bedtime to wake) or 'fixed' (23:00-05:59). Null on rows written before
-- this, which readiness treats as fixed.
alter table public.recovery_checkins
  add column if not exists overnight_window text;

alter table public.recovery_checkins
  drop constraint if exists recovery_checkins_overnight_window_check,
  add constraint recovery_checkins_overnight_window_check
    check (overnight_window is null or overnight_window in ('sleep', 'fixed'));
