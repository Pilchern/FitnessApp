create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  units_system text not null check (units_system in ('imperial', 'metric')),
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  goal_fat_loss boolean not null default true,
  goal_preserve_muscle boolean not null default true,
  goal_improve_vo2 boolean not null default true,
  baseline_schedule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  template_type text not null check (template_type in ('strength', 'cardio')),
  is_archived boolean not null default false,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  status text not null check (status in ('active', 'reauth_required', 'paused', 'error', 'disconnected')),
  account_label text,
  provider_user_id text,
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  last_cursor text,
  last_successful_batch_id uuid,
  last_error text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  integration_connection_id uuid,
  provider text not null,
  batch_type text not null,
  status text not null check (status in ('received', 'processing', 'processed', 'partially_processed', 'failed')),
  provider_cursor text,
  started_at timestamptz,
  finished_at timestamptz,
  raw_item_count integer not null default 0 check (raw_item_count >= 0),
  processed_item_count integer not null default 0 check (processed_item_count >= 0),
  failed_item_count integer not null default 0 check (failed_item_count >= 0),
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint import_batches_connection_fk
    foreign key (integration_connection_id, user_id)
    references public.integration_connections (id, user_id)
);

alter table public.integration_connections
  add constraint integration_connections_last_successful_batch_fk
  foreign key (last_successful_batch_id, user_id)
  references public.import_batches (id, user_id);

create table public.raw_import_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  import_batch_id uuid not null,
  integration_connection_id uuid,
  provider text not null,
  provider_event_type text not null,
  provider_external_id text,
  event_occurred_at timestamptz,
  payload jsonb not null,
  payload_hash text not null,
  mapping_status text not null check (mapping_status in ('pending', 'mapped', 'skipped', 'failed')),
  mapping_error text,
  canonical_target_table text,
  canonical_target_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint raw_import_events_batch_fk
    foreign key (import_batch_id, user_id)
    references public.import_batches (id, user_id)
    on delete cascade,
  constraint raw_import_events_connection_fk
    foreign key (integration_connection_id, user_id)
    references public.integration_connections (id, user_id)
);

create table public.sync_job_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  integration_connection_id uuid,
  job_type text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  trigger_type text not null check (trigger_type in ('scheduled', 'manual', 'retry', 'system')),
  dedupe_key text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  scheduled_for timestamptz,
  error_code text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_job_runs_connection_fk
    foreign key (integration_connection_id, user_id)
    references public.integration_connections (id, user_id),
  constraint sync_job_runs_finished_after_start
    check (finished_at is null or started_at is null or finished_at >= started_at)
);

create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  training_template_id uuid,
  session_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  session_kind text not null check (session_kind in ('zone2', 'vo2', 'recovery', 'other')),
  duration_minutes integer check (duration_minutes >= 0),
  zone2_minutes integer check (zone2_minutes >= 0),
  avg_heart_rate smallint,
  max_heart_rate smallint,
  distance_meters numeric(10, 2),
  source_type text not null check (source_type in ('manual', 'imported')),
  source_provider text,
  source_external_id text,
  import_batch_id uuid,
  raw_import_event_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint cardio_sessions_training_template_fk
    foreign key (training_template_id, user_id)
    references public.training_templates (id, user_id),
  constraint cardio_sessions_import_batch_fk
    foreign key (import_batch_id, user_id)
    references public.import_batches (id, user_id),
  constraint cardio_sessions_raw_import_event_fk
    foreign key (raw_import_event_id, user_id)
    references public.raw_import_events (id, user_id),
  constraint cardio_sessions_finished_after_start
    check (ended_at is null or started_at is null or ended_at >= started_at),
  constraint cardio_sessions_source_check
    check (
      (source_type = 'manual'
        and source_provider is null
        and source_external_id is null
        and import_batch_id is null
        and raw_import_event_id is null)
      or
      (source_type = 'imported' and source_provider is not null)
    )
);

create table public.strength_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  training_template_id uuid,
  session_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  session_name text,
  source_type text not null check (source_type in ('manual', 'imported')),
  source_provider text,
  source_external_id text,
  import_batch_id uuid,
  raw_import_event_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  constraint strength_sessions_training_template_fk
    foreign key (training_template_id, user_id)
    references public.training_templates (id, user_id),
  constraint strength_sessions_import_batch_fk
    foreign key (import_batch_id, user_id)
    references public.import_batches (id, user_id),
  constraint strength_sessions_raw_import_event_fk
    foreign key (raw_import_event_id, user_id)
    references public.raw_import_events (id, user_id),
  constraint strength_sessions_finished_after_start
    check (ended_at is null or started_at is null or ended_at >= started_at),
  constraint strength_sessions_source_check
    check (
      (source_type = 'manual'
        and source_provider is null
        and source_external_id is null
        and import_batch_id is null
        and raw_import_event_id is null)
      or
      (source_type = 'imported' and source_provider is not null)
    )
);

create table public.strength_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  strength_session_id uuid not null,
  exercise_name text not null,
  exercise_order integer not null default 0,
  set_order integer not null default 0,
  weight numeric(8, 2),
  reps integer,
  rpe numeric(3, 1),
  distance_meters numeric(10, 2),
  duration_seconds integer,
  is_warmup boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint strength_exercise_sets_session_fk
    foreign key (strength_session_id, user_id)
    references public.strength_sessions (id, user_id)
    on delete cascade,
  constraint strength_exercise_sets_non_negative_orders
    check (exercise_order >= 0 and set_order >= 0),
  constraint strength_exercise_sets_non_negative_duration
    check (duration_seconds is null or duration_seconds >= 0)
);

create table public.recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checkin_date date not null,
  resting_heart_rate smallint,
  hrv numeric(6, 2),
  sleep_duration_minutes integer,
  sleep_quality smallint check (sleep_quality between 1 and 5),
  energy_level smallint check (energy_level between 1 and 5),
  readiness_level smallint check (readiness_level between 1 and 5),
  alcohol_count smallint not null default 0 check (alcohol_count >= 0),
  notes text,
  source_type text not null check (source_type in ('manual', 'imported', 'mixed')),
  source_provider text,
  source_external_id text,
  import_batch_id uuid,
  raw_import_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint recovery_checkins_import_batch_fk
    foreign key (import_batch_id, user_id)
    references public.import_batches (id, user_id),
  constraint recovery_checkins_raw_import_event_fk
    foreign key (raw_import_event_id, user_id)
    references public.raw_import_events (id, user_id),
  constraint recovery_checkins_source_check
    check (
      (source_type = 'manual'
        and source_provider is null
        and source_external_id is null
        and import_batch_id is null
        and raw_import_event_id is null)
      or
      (source_type in ('imported', 'mixed') and source_provider is not null)
    ),
  constraint recovery_checkins_sleep_duration_non_negative
    check (sleep_duration_minutes is null or sleep_duration_minutes >= 0)
);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_lb numeric(6, 2),
  weight_kg numeric(6, 2),
  waist_in numeric(5, 2),
  waist_cm numeric(5, 2),
  body_fat_pct numeric(5, 2),
  muscle_mass_lb numeric(6, 2),
  muscle_mass_kg numeric(6, 2),
  source_type text not null check (source_type in ('manual', 'imported')),
  source_provider text,
  source_external_id text,
  import_batch_id uuid,
  raw_import_event_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint body_metrics_import_batch_fk
    foreign key (import_batch_id, user_id)
    references public.import_batches (id, user_id),
  constraint body_metrics_raw_import_event_fk
    foreign key (raw_import_event_id, user_id)
    references public.raw_import_events (id, user_id),
  constraint body_metrics_source_check
    check (
      (source_type = 'manual'
        and source_provider is null
        and source_external_id is null
        and import_batch_id is null
        and raw_import_event_id is null)
      or
      (source_type = 'imported' and source_provider is not null)
    )
);

create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  protein_hit boolean,
  meals_on_plan boolean,
  no_post_dinner_snacking boolean,
  junk_leakage boolean,
  fiber_taken boolean,
  alcohol_count smallint not null default 0 check (alcohol_count >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  status text not null check (status in ('draft', 'completed')),
  summary jsonb not null default '{}'::jsonb,
  reflection text,
  wins text,
  adjustments text,
  next_week_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  unique (id, user_id),
  constraint weekly_reviews_week_bounds check (week_end = week_start + 6),
  constraint weekly_reviews_completed_at_check
    check (status <> 'completed' or completed_at is not null)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  title text,
  body text not null,
  tags text[] not null default '{}',
  related_weekly_review_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint journal_entries_related_weekly_review_fk
    foreign key (related_weekly_review_id, user_id)
    references public.weekly_reviews (id, user_id)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_date date not null,
  insight_type text not null,
  status text not null check (status in ('active', 'dismissed', 'archived')),
  title text not null,
  body text not null,
  evidence jsonb not null default '{}'::jsonb,
  source_kind text not null check (source_kind in ('rule', 'manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dismissed_at timestamptz,
  deleted_at timestamptz,
  constraint insights_dismissed_at_check
    check (status <> 'dismissed' or dismissed_at is not null)
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_training_templates_updated_at
before update on public.training_templates
for each row
execute function public.set_updated_at();

create trigger set_integration_connections_updated_at
before update on public.integration_connections
for each row
execute function public.set_updated_at();

create trigger set_import_batches_updated_at
before update on public.import_batches
for each row
execute function public.set_updated_at();

create trigger set_sync_job_runs_updated_at
before update on public.sync_job_runs
for each row
execute function public.set_updated_at();

create trigger set_cardio_sessions_updated_at
before update on public.cardio_sessions
for each row
execute function public.set_updated_at();

create trigger set_strength_sessions_updated_at
before update on public.strength_sessions
for each row
execute function public.set_updated_at();

create trigger set_strength_exercise_sets_updated_at
before update on public.strength_exercise_sets
for each row
execute function public.set_updated_at();

create trigger set_recovery_checkins_updated_at
before update on public.recovery_checkins
for each row
execute function public.set_updated_at();

create trigger set_body_metrics_updated_at
before update on public.body_metrics
for each row
execute function public.set_updated_at();

create trigger set_nutrition_logs_updated_at
before update on public.nutrition_logs
for each row
execute function public.set_updated_at();

create trigger set_weekly_reviews_updated_at
before update on public.weekly_reviews
for each row
execute function public.set_updated_at();

create trigger set_journal_entries_updated_at
before update on public.journal_entries
for each row
execute function public.set_updated_at();

create trigger set_insights_updated_at
before update on public.insights
for each row
execute function public.set_updated_at();
