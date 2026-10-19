-- Post-op training program: a data-driven program -> block -> week ->
-- session -> exercise prescription model, so a new block is rows, not code.
-- Plus manual gates, explicit skip/stop outcomes and a settings table for
-- every target and threshold.
--
-- Additive only. New tables, plus nullable columns on strength_exercise_sets
-- (side, peak force), recovery_checkins (morning knee check) and
-- cardio_sessions (total output kJ, run/walk minutes). No existing column, constraint or row is
-- changed, so existing history reads exactly as before.
--
-- Week numbers count whole weeks from training_programs.week_anchor_date
-- (the surgery date): anchor + 7N .. anchor + 7N + 6 is week N.

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  week_anchor_date date not null,
  return_to_sport_week smallint check (return_to_sport_week between 0 and 520),
  test_day_url text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  constraint training_programs_user_name_key unique (user_id, name)
);

-- One active program at a time.
create unique index if not exists training_programs_one_active_idx
  on public.training_programs (user_id)
  where is_active and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Blocks: a run of weeks with one default rep scheme
-- ---------------------------------------------------------------------------
create table if not exists public.program_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null,
  name text not null,
  start_week smallint not null check (start_week between 0 and 520),
  end_week smallint not null check (end_week between 0 and 520),
  -- Default prescription for exercises that leave theirs null.
  sets_min smallint check (sets_min between 1 and 20),
  sets_max smallint check (sets_max between 1 and 20),
  reps_min smallint check (reps_min between 1 and 100),
  reps_max smallint check (reps_max between 1 and 100),
  rir_target numeric(3, 1) check (rir_target between 0 and 6),
  rep_scheme text,
  -- Run another block's sessions (a deload repeats the block before it).
  sessions_from_block_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  constraint program_blocks_program_name_key unique (program_id, name),
  constraint program_blocks_week_order check (end_week >= start_week),
  constraint program_blocks_sets_order
    check (sets_min is null or sets_max is null or sets_max >= sets_min),
  constraint program_blocks_reps_order
    check (reps_min is null or reps_max is null or reps_max >= reps_min),
  constraint program_blocks_program_fk
    foreign key (program_id, user_id)
    references public.training_programs (id, user_id)
    on delete cascade,
  constraint program_blocks_sessions_from_fk
    foreign key (sessions_from_block_id, user_id)
    references public.program_blocks (id, user_id)
);

-- ---------------------------------------------------------------------------
-- Weeks: per-week flags. The block for a week comes from the block ranges.
-- ---------------------------------------------------------------------------
create table if not exists public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null,
  week_number smallint not null check (week_number between 0 and 520),
  is_deload boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint program_weeks_program_week_key unique (program_id, week_number),
  constraint program_weeks_program_fk
    foreign key (program_id, user_id)
    references public.training_programs (id, user_id)
    on delete cascade
);

-- ---------------------------------------------------------------------------
-- Gates: manual "cleared" toggles (jog, plyo, depth past 90, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.program_gates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  gate_key text not null check (gate_key ~ '^[a-z0-9_]{1,40}$'),
  label text not null,
  cleared_on date,
  -- Earliest date clearance is expected (display only).
  earliest_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint program_gates_user_key unique (user_id, gate_key)
);

-- ---------------------------------------------------------------------------
-- Session templates: what runs on a weekday within a block
-- ---------------------------------------------------------------------------
create table if not exists public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  block_id uuid not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  sort_order smallint not null default 0,
  session_type text not null
    check (session_type in ('lift', 'peloton', 'run', 'test', 'rest', 'walk_jog')),
  name text not null,
  -- Lift days: the existing upper-body template that follows the leg block.
  upper_template_id uuid,
  -- Peloton and walk-jog days.
  ride_kind text check (ride_kind in ('zone2', 'climb_intervals')),
  minutes_min smallint check (minutes_min between 0 and 600),
  minutes_max smallint check (minutes_max between 0 and 600),
  structure text,
  gate_key text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  constraint program_sessions_block_day_key
    unique (block_id, day_of_week, sort_order),
  -- Walk-jog never lands on a lift day (Mon/Wed/Fri).
  constraint program_sessions_walk_jog_days
    check (session_type <> 'walk_jog' or day_of_week not in (1, 3, 5)),
  constraint program_sessions_minutes_order
    check (minutes_min is null or minutes_max is null or minutes_max >= minutes_min),
  constraint program_sessions_block_fk
    foreign key (block_id, user_id)
    references public.program_blocks (id, user_id)
    on delete cascade,
  constraint program_sessions_upper_template_fk
    foreign key (upper_template_id, user_id)
    references public.training_templates (id, user_id),
  constraint program_sessions_gate_fk
    foreign key (user_id, gate_key)
    references public.program_gates (user_id, gate_key)
);

-- ---------------------------------------------------------------------------
-- Exercise prescriptions within a session template
-- ---------------------------------------------------------------------------
create table if not exists public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_session_id uuid not null,
  exercise_order smallint not null check (exercise_order >= 0),
  exercise_name text not null,
  -- 'legs' is the knee work (progression engine, deloads, knee-off swap);
  -- 'upper' runs as logged, loads prefilled from history.
  block_part text not null default 'legs' check (block_part in ('legs', 'upper')),
  -- Only in these post-op weeks (inclusive); null = no limit.
  from_week smallint check (from_week between 0 and 520),
  until_week smallint check (until_week between 0 and 520),
  -- Muscle a working set counts toward in the weekly hard-set counter; null
  -- for drills (landing prep, balance, gait) that are not hard sets.
  primary_muscle text check (
    primary_muscle in ('quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'core')
  ),
  -- 'normal': shown only when today's knee check is normal (landing prep).
  readiness_requirement text not null default 'any'
    check (readiness_requirement in ('any', 'normal')),
  measure text not null default 'reps' check (measure in ('reps', 'time', 'force')),
  side_mode text not null default 'bilateral'
    check (side_mode in ('bilateral', 'per_leg')),
  load_kind text not null default 'bodyweight'
    check (load_kind in ('barbell', 'dumbbell', 'cuff', 'bodyweight', 'band')),
  -- Null means "use the block's default".
  sets_min smallint check (sets_min between 1 and 20),
  sets_max smallint check (sets_max between 1 and 20),
  reps_min smallint check (reps_min between 1 and 100),
  reps_max smallint check (reps_max between 1 and 100),
  rir_target numeric(3, 1) check (rir_target between 0 and 6),
  seconds_target smallint check (seconds_target between 1 and 3600),
  tempo text,
  gate_key text,
  -- Shown in place of this exercise while its gate is not cleared.
  substitute_name text,
  substitute_load_kind text
    check (substitute_load_kind in ('barbell', 'dumbbell', 'cuff', 'bodyweight', 'band')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint program_exercises_session_order_key
    unique (program_session_id, exercise_order),
  constraint program_exercises_sets_order
    check (sets_min is null or sets_max is null or sets_max >= sets_min),
  constraint program_exercises_reps_order
    check (reps_min is null or reps_max is null or reps_max >= reps_min),
  constraint program_exercises_session_fk
    foreign key (program_session_id, user_id)
    references public.program_sessions (id, user_id)
    on delete cascade,
  constraint program_exercises_gate_fk
    foreign key (user_id, gate_key)
    references public.program_gates (user_id, gate_key)
);

-- ---------------------------------------------------------------------------
-- Session outcomes: a skip (with a reason) or a red-flag stop is explicit,
-- not a silent gap.
-- ---------------------------------------------------------------------------
create table if not exists public.program_session_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_session_id uuid not null,
  outcome_date date not null,
  outcome text not null check (outcome in ('skipped', 'stopped')),
  reason text not null check (
    reason in ('time', 'knee', 'sick', 'travel', 'other',
               'giving_way', 'locking', 'sharp_pain')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint program_session_outcomes_session_date_key
    unique (user_id, program_session_id, outcome_date),
  constraint program_session_outcomes_session_fk
    foreign key (program_session_id, user_id)
    references public.program_sessions (id, user_id)
    on delete cascade
);

-- ---------------------------------------------------------------------------
-- Targets and thresholds, one row per key, edited in Settings.
-- ---------------------------------------------------------------------------
create table if not exists public.training_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{1,60}$'),
  value numeric(10, 2),
  text_value text,
  label text not null,
  unit text,
  group_name text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint training_settings_user_key unique (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Logging columns on existing tables (all nullable, additive)
-- ---------------------------------------------------------------------------

-- Per-leg sets: 'left' or 'right'; null for bilateral and all older sets.
alter table public.strength_exercise_sets
  add column if not exists side text,
  add column if not exists peak_force_newtons numeric(6, 1);

alter table public.strength_exercise_sets
  drop constraint if exists strength_exercise_sets_side_check,
  add constraint strength_exercise_sets_side_check
    check (side is null or side in ('left', 'right'));

alter table public.strength_exercise_sets
  drop constraint if exists strength_exercise_sets_peak_force_check,
  add constraint strength_exercise_sets_peak_force_check
    check (peak_force_newtons is null or (peak_force_newtons >= 0 and peak_force_newtons <= 5000));

-- Morning knee check, saved into the day's recovery row.
alter table public.recovery_checkins
  add column if not exists knee_swelling text,
  add column if not exists knee_graft_pain smallint,
  add column if not exists knee_extension_full boolean;

alter table public.recovery_checkins
  drop constraint if exists recovery_checkins_knee_swelling_check,
  add constraint recovery_checkins_knee_swelling_check
    check (knee_swelling is null or knee_swelling in ('none', 'trace', '1+', '2+'));

alter table public.recovery_checkins
  drop constraint if exists recovery_checkins_knee_graft_pain_check,
  add constraint recovery_checkins_knee_graft_pain_check
    check (knee_graft_pain is null or knee_graft_pain between 0 and 10);

-- Peloton total output as shown on the bike.
alter table public.cardio_sessions
  add column if not exists total_output_kj numeric(6, 1),
  -- Walk-jog: total minutes running and walking.
  add column if not exists run_minutes numeric(5, 1),
  add column if not exists walk_minutes numeric(5, 1);

alter table public.cardio_sessions
  drop constraint if exists cardio_sessions_run_walk_minutes_check,
  add constraint cardio_sessions_run_walk_minutes_check
    check ((run_minutes is null or run_minutes between 0 and 600)
       and (walk_minutes is null or walk_minutes between 0 and 600));

alter table public.cardio_sessions
  drop constraint if exists cardio_sessions_total_output_kj_check,
  add constraint cardio_sessions_total_output_kj_check
    check (total_output_kj is null or (total_output_kj >= 0 and total_output_kj <= 5000));

-- ---------------------------------------------------------------------------
-- updated_at triggers, indexes, grants, RLS
-- ---------------------------------------------------------------------------
-- Plain statements, no DO block (the Supabase MCP connector times out on DO).
drop trigger if exists set_training_programs_updated_at on public.training_programs;
create trigger set_training_programs_updated_at before update on public.training_programs for each row execute function public.set_updated_at();
grant select, insert, update on public.training_programs to authenticated;
alter table public.training_programs enable row level security;
drop policy if exists "training_programs_select_own" on public.training_programs;
create policy "training_programs_select_own" on public.training_programs for select to authenticated using (public.owns_row(user_id));
drop policy if exists "training_programs_insert_own" on public.training_programs;
create policy "training_programs_insert_own" on public.training_programs for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "training_programs_update_own" on public.training_programs;
create policy "training_programs_update_own" on public.training_programs for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

drop trigger if exists set_program_blocks_updated_at on public.program_blocks;
create trigger set_program_blocks_updated_at before update on public.program_blocks for each row execute function public.set_updated_at();
grant select, insert, update on public.program_blocks to authenticated;
alter table public.program_blocks enable row level security;
drop policy if exists "program_blocks_select_own" on public.program_blocks;
create policy "program_blocks_select_own" on public.program_blocks for select to authenticated using (public.owns_row(user_id));
drop policy if exists "program_blocks_insert_own" on public.program_blocks;
create policy "program_blocks_insert_own" on public.program_blocks for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "program_blocks_update_own" on public.program_blocks;
create policy "program_blocks_update_own" on public.program_blocks for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

drop trigger if exists set_program_weeks_updated_at on public.program_weeks;
create trigger set_program_weeks_updated_at before update on public.program_weeks for each row execute function public.set_updated_at();
grant select, insert, update on public.program_weeks to authenticated;
alter table public.program_weeks enable row level security;
drop policy if exists "program_weeks_select_own" on public.program_weeks;
create policy "program_weeks_select_own" on public.program_weeks for select to authenticated using (public.owns_row(user_id));
drop policy if exists "program_weeks_insert_own" on public.program_weeks;
create policy "program_weeks_insert_own" on public.program_weeks for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "program_weeks_update_own" on public.program_weeks;
create policy "program_weeks_update_own" on public.program_weeks for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

drop trigger if exists set_program_gates_updated_at on public.program_gates;
create trigger set_program_gates_updated_at before update on public.program_gates for each row execute function public.set_updated_at();
grant select, insert, update on public.program_gates to authenticated;
alter table public.program_gates enable row level security;
drop policy if exists "program_gates_select_own" on public.program_gates;
create policy "program_gates_select_own" on public.program_gates for select to authenticated using (public.owns_row(user_id));
drop policy if exists "program_gates_insert_own" on public.program_gates;
create policy "program_gates_insert_own" on public.program_gates for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "program_gates_update_own" on public.program_gates;
create policy "program_gates_update_own" on public.program_gates for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

drop trigger if exists set_program_sessions_updated_at on public.program_sessions;
create trigger set_program_sessions_updated_at before update on public.program_sessions for each row execute function public.set_updated_at();
grant select, insert, update on public.program_sessions to authenticated;
alter table public.program_sessions enable row level security;
drop policy if exists "program_sessions_select_own" on public.program_sessions;
create policy "program_sessions_select_own" on public.program_sessions for select to authenticated using (public.owns_row(user_id));
drop policy if exists "program_sessions_insert_own" on public.program_sessions;
create policy "program_sessions_insert_own" on public.program_sessions for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "program_sessions_update_own" on public.program_sessions;
create policy "program_sessions_update_own" on public.program_sessions for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

drop trigger if exists set_program_exercises_updated_at on public.program_exercises;
create trigger set_program_exercises_updated_at before update on public.program_exercises for each row execute function public.set_updated_at();
grant select, insert, update on public.program_exercises to authenticated;
alter table public.program_exercises enable row level security;
drop policy if exists "program_exercises_select_own" on public.program_exercises;
create policy "program_exercises_select_own" on public.program_exercises for select to authenticated using (public.owns_row(user_id));
drop policy if exists "program_exercises_insert_own" on public.program_exercises;
create policy "program_exercises_insert_own" on public.program_exercises for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "program_exercises_update_own" on public.program_exercises;
create policy "program_exercises_update_own" on public.program_exercises for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

drop trigger if exists set_program_session_outcomes_updated_at on public.program_session_outcomes;
create trigger set_program_session_outcomes_updated_at before update on public.program_session_outcomes for each row execute function public.set_updated_at();
grant select, insert, update on public.program_session_outcomes to authenticated;
alter table public.program_session_outcomes enable row level security;
drop policy if exists "program_session_outcomes_select_own" on public.program_session_outcomes;
create policy "program_session_outcomes_select_own" on public.program_session_outcomes for select to authenticated using (public.owns_row(user_id));
drop policy if exists "program_session_outcomes_insert_own" on public.program_session_outcomes;
create policy "program_session_outcomes_insert_own" on public.program_session_outcomes for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "program_session_outcomes_update_own" on public.program_session_outcomes;
create policy "program_session_outcomes_update_own" on public.program_session_outcomes for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

drop trigger if exists set_training_settings_updated_at on public.training_settings;
create trigger set_training_settings_updated_at before update on public.training_settings for each row execute function public.set_updated_at();
grant select, insert, update on public.training_settings to authenticated;
alter table public.training_settings enable row level security;
drop policy if exists "training_settings_select_own" on public.training_settings;
create policy "training_settings_select_own" on public.training_settings for select to authenticated using (public.owns_row(user_id));
drop policy if exists "training_settings_insert_own" on public.training_settings;
create policy "training_settings_insert_own" on public.training_settings for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "training_settings_update_own" on public.training_settings;
create policy "training_settings_update_own" on public.training_settings for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

create index if not exists program_blocks_program_idx
  on public.program_blocks (program_id, start_week)
  where deleted_at is null;

create index if not exists program_sessions_block_idx
  on public.program_sessions (block_id, day_of_week)
  where deleted_at is null;

create index if not exists program_exercises_session_idx
  on public.program_exercises (program_session_id, exercise_order)
  where deleted_at is null;

-- Foreign-key lookups (Supabase advisor: unindexed foreign keys).
create index if not exists program_blocks_sessions_from_idx
  on public.program_blocks (sessions_from_block_id)
  where sessions_from_block_id is not null;

create index if not exists program_sessions_upper_template_idx
  on public.program_sessions (upper_template_id)
  where upper_template_id is not null;

create index if not exists program_sessions_gate_idx
  on public.program_sessions (user_id, gate_key)
  where gate_key is not null;

create index if not exists program_session_outcomes_date_idx
  on public.program_session_outcomes (user_id, outcome_date)
  where deleted_at is null;

create index if not exists program_session_outcomes_session_idx
  on public.program_session_outcomes (program_session_id, user_id);

create index if not exists program_exercises_gate_idx
  on public.program_exercises (user_id, gate_key)
  where gate_key is not null;
