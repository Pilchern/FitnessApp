-- Real numeric goal targets on profiles (replacing the boolean-only
-- goal_fat_loss/goal_preserve_muscle/goal_improve_vo2 flags for progress
-- tracking), plus an optional day-of-week a strength/cardio template is
-- scheduled for, so the app can surface "today's plan" instead of the
-- user manually re-picking a template every session.
alter table public.profiles
  add column if not exists target_weight_lb numeric(6, 1),
  add column if not exists target_date date;

alter table public.training_templates
  add column if not exists scheduled_day_of_week smallint
    check (scheduled_day_of_week between 0 and 6);
