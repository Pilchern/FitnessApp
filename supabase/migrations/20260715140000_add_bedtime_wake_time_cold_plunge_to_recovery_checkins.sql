-- Two additions to recovery_checkins:
--
-- 1. bedtime_local / wake_time_local: clock times (e.g. "22:45", "06:30"),
--    stored as Postgres `time` (no date/timezone component) since these
--    represent local wall-clock times the user reports, distinct from the
--    existing sleep_duration_minutes duration column.
--
-- 2. cold_plunge_completed: a daily yes/no behavior flag. Modeled as a
--    nullable boolean (no default) rather than NOT NULL DEFAULT false —
--    this mirrors the existing nutrition_logs convention (protein_hit,
--    meals_on_plan, no_post_dinner_snacking, junk_leakage, fiber_taken),
--    where "not yet answered" (null) is kept distinct from "answered no"
--    (false) for daily checklist-style behaviors.

alter table public.recovery_checkins
  add column if not exists bedtime_local time,
  add column if not exists wake_time_local time,
  add column if not exists cold_plunge_completed boolean;
