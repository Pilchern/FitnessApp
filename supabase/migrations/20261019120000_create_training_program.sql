-- Post-op training program: a data-driven program -> block -> week ->
-- session -> exercise prescription model, so a new block is rows, not code.
--
-- Additive only. New tables, plus nullable columns on strength_exercise_sets
-- (side, peak force), recovery_checkins (morning knee check) and
-- cardio_sessions (total output kJ). No existing column, constraint or row is
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
  add column if not exists total_output_kj numeric(6, 1);

alter table public.cardio_sessions
  drop constraint if exists cardio_sessions_total_output_kj_check,
  add constraint cardio_sessions_total_output_kj_check
    check (total_output_kj is null or (total_output_kj >= 0 and total_output_kj <= 5000));

-- ---------------------------------------------------------------------------
-- updated_at triggers, indexes, grants, RLS
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'training_programs', 'program_blocks', 'program_weeks',
    'program_gates', 'program_sessions', 'program_exercises'
  ]
  loop
    execute format('drop trigger if exists set_%1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$I '
      'for each row execute function public.set_updated_at()', t);

    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%1$s_select_own" on public.%1$I', t);
    execute format(
      'create policy "%1$s_select_own" on public.%1$I for select to authenticated '
      'using (public.owns_row(user_id))', t);

    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format(
      'create policy "%1$s_insert_own" on public.%1$I for insert to authenticated '
      'with check (public.owns_row(user_id))', t);

    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);
    execute format(
      'create policy "%1$s_update_own" on public.%1$I for update to authenticated '
      'using (public.owns_row(user_id)) with check (public.owns_row(user_id))', t);
  end loop;
end
$$;

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

create index if not exists program_exercises_gate_idx
  on public.program_exercises (user_id, gate_key)
  where gate_key is not null;
