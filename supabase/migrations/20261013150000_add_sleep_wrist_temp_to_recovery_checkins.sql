-- Apple Watch sleeping wrist temperature (via Health Auto Export's overnight
-- automation), absolute Celsius. Readiness compares it with the user's own
-- 30-day median, so only the night-to-night change matters. Nullable;
-- additive only.
alter table public.recovery_checkins
  add column if not exists sleep_wrist_temp_c numeric(4, 2);

alter table public.recovery_checkins
  drop constraint if exists recovery_checkins_sleep_wrist_temp_c_check,
  add constraint recovery_checkins_sleep_wrist_temp_c_check
    check (sleep_wrist_temp_c is null or sleep_wrist_temp_c between 25 and 45);
