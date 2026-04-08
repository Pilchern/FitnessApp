alter table public.strength_sessions
  add column if not exists duration_minutes integer,
  add column if not exists readiness_pre smallint,
  add column if not exists energy_post smallint,
  add column if not exists completed_as_planned boolean not null default true;

alter table public.strength_sessions
  drop constraint if exists strength_sessions_duration_minutes_check,
  add constraint strength_sessions_duration_minutes_check
    check (duration_minutes is null or duration_minutes >= 0);

alter table public.strength_sessions
  drop constraint if exists strength_sessions_readiness_pre_check,
  add constraint strength_sessions_readiness_pre_check
    check (readiness_pre is null or readiness_pre between 1 and 10);

alter table public.strength_sessions
  drop constraint if exists strength_sessions_energy_post_check,
  add constraint strength_sessions_energy_post_check
    check (energy_post is null or energy_post between 1 and 10);

alter table public.strength_exercise_sets
  add column if not exists rir numeric(3, 1);

alter table public.strength_exercise_sets
  drop constraint if exists strength_exercise_sets_rir_check,
  add constraint strength_exercise_sets_rir_check
    check (rir is null or (rir >= 0 and rir <= 6));
