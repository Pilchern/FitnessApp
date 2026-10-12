-- Apple Watch strength workouts (via Health Auto Export) fill these on the
-- day's lift session: average and max heart rate and active energy. Duration
-- and start/end already have columns. All nullable; additive only.
alter table public.strength_sessions
  add column if not exists avg_heart_rate smallint,
  add column if not exists max_heart_rate smallint,
  add column if not exists active_energy_kcal integer;

alter table public.strength_sessions
  drop constraint if exists strength_sessions_avg_heart_rate_check,
  add constraint strength_sessions_avg_heart_rate_check
    check (avg_heart_rate is null or avg_heart_rate between 20 and 250);

alter table public.strength_sessions
  drop constraint if exists strength_sessions_max_heart_rate_check,
  add constraint strength_sessions_max_heart_rate_check
    check (max_heart_rate is null or max_heart_rate between 20 and 250);

alter table public.strength_sessions
  drop constraint if exists strength_sessions_active_energy_kcal_check,
  add constraint strength_sessions_active_energy_kcal_check
    check (active_energy_kcal is null or active_energy_kcal between 0 and 5000);
