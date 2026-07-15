-- Daily whole-body activity metrics (steps, VO2 max, non-sleep resting heart
-- rate, exercise minutes, active energy burn). Distinct from
-- recovery_checkins (subjective + sleep-stage data) and body_metrics
-- (weight/composition) — this table holds daytime activity-ring style
-- metrics, one row per (user_id, metric_date). Primary source today is the
-- Apple Health "daily metrics" webhook (see
-- apps/web/src/app/api/integrations/apple-health/daily-metrics/route.ts).

create table if not exists public.daily_activity_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric_date date not null,
  steps integer,
  vo2_max numeric(5, 2),
  resting_heart_rate smallint,
  exercise_minutes integer,
  active_energy_kcal numeric(7, 2),
  source_type text not null check (source_type in ('manual', 'imported')),
  source_provider text,
  source_external_id text,
  import_batch_id uuid,
  raw_import_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  constraint daily_activity_metrics_import_batch_fk
    foreign key (import_batch_id, user_id)
    references public.import_batches (id, user_id),
  constraint daily_activity_metrics_raw_import_event_fk
    foreign key (raw_import_event_id, user_id)
    references public.raw_import_events (id, user_id),
  constraint daily_activity_metrics_source_check
    check (
      (source_type = 'manual'
        and source_provider is null
        and source_external_id is null
        and import_batch_id is null
        and raw_import_event_id is null)
      or
      (source_type = 'imported' and source_provider is not null)
    ),
  constraint daily_activity_metrics_steps_non_negative
    check (steps is null or steps >= 0),
  constraint daily_activity_metrics_vo2_max_positive
    check (vo2_max is null or vo2_max > 0),
  constraint daily_activity_metrics_resting_heart_rate_positive
    check (resting_heart_rate is null or resting_heart_rate > 0),
  constraint daily_activity_metrics_exercise_minutes_non_negative
    check (exercise_minutes is null or exercise_minutes >= 0),
  constraint daily_activity_metrics_active_energy_non_negative
    check (active_energy_kcal is null or active_energy_kcal >= 0)
);

create trigger set_daily_activity_metrics_updated_at
before update on public.daily_activity_metrics
for each row
execute function public.set_updated_at();

create unique index if not exists daily_activity_metrics_user_date_unique_idx
  on public.daily_activity_metrics (user_id, metric_date)
  where deleted_at is null;

create index if not exists daily_activity_metrics_user_date_idx
  on public.daily_activity_metrics (user_id, metric_date desc)
  where deleted_at is null;

create unique index if not exists daily_activity_metrics_provider_external_unique_idx
  on public.daily_activity_metrics (user_id, source_provider, source_external_id)
  where source_external_id is not null and deleted_at is null;

grant select, insert, update on public.daily_activity_metrics to authenticated;

alter table public.daily_activity_metrics enable row level security;

create policy "daily_activity_metrics_select_own"
  on public.daily_activity_metrics
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "daily_activity_metrics_insert_own"
  on public.daily_activity_metrics
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "daily_activity_metrics_update_own"
  on public.daily_activity_metrics
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));
