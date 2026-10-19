-- Program v1 (2026-10-19): the columns and values the canonical program needs.
-- Additive only: every new column is nullable or has a default, and the
-- widened checks still accept every existing row, so the app running before
-- this change keeps reading the program. Safe to rerun.

-- Program version label ---------------------------------------------------------
alter table public.training_programs
  add column if not exists version text;

-- Blocks: how a block starts --------------------------------------------------------
-- week:   by post-op week (the default, every block so far).
-- gate:   by week, but only once gate_key is cleared; until then the block in
--         fallback_block_id runs (return to sport waits on the rts gate).
-- manual: never by week; runs from activated_on (the triathlon placeholder).
alter table public.program_blocks
  add column if not exists activation text not null default 'week',
  add column if not exists gate_key text,
  add column if not exists fallback_block_id uuid,
  add column if not exists activated_on date;

alter table public.program_blocks
  drop constraint if exists program_blocks_activation_check,
  add constraint program_blocks_activation_check
    check (activation in ('week', 'gate', 'manual'));

alter table public.program_blocks
  drop constraint if exists program_blocks_gate_needs_key,
  add constraint program_blocks_gate_needs_key
    check (activation <> 'gate' or gate_key is not null);

alter table public.program_blocks
  drop constraint if exists program_blocks_gate_fk,
  add constraint program_blocks_gate_fk
    foreign key (user_id, gate_key)
    references public.program_gates (user_id, gate_key);

alter table public.program_blocks
  drop constraint if exists program_blocks_fallback_fk,
  add constraint program_blocks_fallback_fk
    foreign key (fallback_block_id, user_id)
    references public.program_blocks (id, user_id);

-- Sessions: more kinds of day, optional sessions ----------------------------------
alter table public.program_sessions
  add column if not exists is_optional boolean not null default false;

alter table public.program_sessions
  drop constraint if exists program_sessions_session_type_check,
  add constraint program_sessions_session_type_check
    check (session_type in
      ('lift', 'peloton', 'run', 'test', 'rest', 'walk_jog', 'walk', 'golf'));

alter table public.program_sessions
  drop constraint if exists program_sessions_ride_kind_check,
  add constraint program_sessions_ride_kind_check
    check (ride_kind in
      ('zone2', 'climb_intervals', 'threshold_intervals', 'vo2_intervals'));

-- Exercises: library fields ---------------------------------------------------------
-- category drives deloads (plyo volume halves) and the session order;
-- counts_as_quad_set drives the weekly hard quad set counter; cue is the
-- one-line coaching cue; extra_gate_key is a second gate (front squat needs
-- depth_past_90 and barbell); substitute reps cover a fallback with its own
-- rep range (Nordic -> slider curl 3 x 10).
alter table public.program_exercises
  add column if not exists category text,
  add column if not exists counts_as_quad_set boolean not null default false,
  add column if not exists cue text,
  add column if not exists extra_gate_key text,
  add column if not exists distance_meters_target smallint,
  add column if not exists substitute_reps_min smallint,
  add column if not exists substitute_reps_max smallint;

alter table public.program_exercises
  drop constraint if exists program_exercises_category_check,
  add constraint program_exercises_category_check
    check (category is null or category in
      ('main', 'accessory', 'plyo', 'core', 'conditioning', 'mobility'));

alter table public.program_exercises
  drop constraint if exists program_exercises_measure_check,
  add constraint program_exercises_measure_check
    check (measure in ('reps', 'time', 'force', 'distance'));

alter table public.program_exercises
  drop constraint if exists program_exercises_side_mode_check,
  add constraint program_exercises_side_mode_check
    check (side_mode in ('bilateral', 'per_leg', 'per_side'));

alter table public.program_exercises
  drop constraint if exists program_exercises_distance_check,
  add constraint program_exercises_distance_check
    check (distance_meters_target is null or distance_meters_target between 1 and 10000);

alter table public.program_exercises
  drop constraint if exists program_exercises_substitute_reps_check,
  add constraint program_exercises_substitute_reps_check
    check ((substitute_reps_min is null or substitute_reps_min between 1 and 100)
       and (substitute_reps_max is null or substitute_reps_max between 1 and 100)
       and (substitute_reps_min is null or substitute_reps_max is null
            or substitute_reps_max >= substitute_reps_min));

alter table public.program_exercises
  drop constraint if exists program_exercises_extra_gate_fk,
  add constraint program_exercises_extra_gate_fk
    foreign key (user_id, extra_gate_key)
    references public.program_gates (user_id, gate_key);

create index if not exists program_blocks_fallback_idx
  on public.program_blocks (fallback_block_id)
  where fallback_block_id is not null;
