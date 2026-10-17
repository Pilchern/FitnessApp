-- Per-ride fitness markers computed from Apple Health power and heart rate
-- (Health Auto Export, per-minute series):
-- - best_5min_watts / best_20min_watts: best rolling 5 and 20 minute average
--   power. The 5 minute best is the VO2 trend proxy; the 20 minute best feeds
--   FTP estimates. Peloton (original Bike) power is estimated, so these are
--   for trends on the same bike, not absolute values.
-- - zone2_heart_rate: median heart rate over the minutes spent in the Zone 2
--   power band after a 10 minute warm-up. Falling over months at the same
--   watts is the aerobic fitness signal.
-- All nullable; additive only.
alter table public.cardio_sessions
  add column if not exists best_5min_watts smallint,
  add column if not exists best_20min_watts smallint,
  add column if not exists zone2_heart_rate smallint;

alter table public.cardio_sessions
  drop constraint if exists cardio_sessions_best_5min_watts_check,
  add constraint cardio_sessions_best_5min_watts_check
    check (best_5min_watts is null or best_5min_watts between 0 and 2000);

alter table public.cardio_sessions
  drop constraint if exists cardio_sessions_best_20min_watts_check,
  add constraint cardio_sessions_best_20min_watts_check
    check (best_20min_watts is null or best_20min_watts between 0 and 2000);

alter table public.cardio_sessions
  drop constraint if exists cardio_sessions_zone2_heart_rate_check,
  add constraint cardio_sessions_zone2_heart_rate_check
    check (zone2_heart_rate is null or zone2_heart_rate between 20 and 250);
