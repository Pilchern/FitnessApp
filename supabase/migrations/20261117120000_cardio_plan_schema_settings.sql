-- Cardio plan, part A (owner request 2026-11-17): schema and settings.
-- Apply BEFORE the code merges. Part B (20261117120100) changes the ride
-- sessions and must follow the production deploy: older code rejects the
-- new ride kind on read.
--
-- 1. program_sessions.ride_kind accepts 'zone2_long' (Saturday long Zone 2,
--    minutes from the cardio progression).
-- 2. cardio_sessions.interval_outputs: average watts per VO2 work interval.
-- 3. Settings, group "Cardio": the Zone 2 band (the one place it lives),
--    VO2 target HR, plan start and the 6-week progression, the gated sprint
--    finisher, the Saturday 7:00 AM calendar time and the fallback rules.
--
-- Additive except the ride_kind check, which is replaced with a wider one.
-- Idempotent.

-- 1. Ride kind ----------------------------------------------------------------
alter table public.program_sessions
  drop constraint if exists program_sessions_ride_kind_check,
  add constraint program_sessions_ride_kind_check
    check (ride_kind in
      ('zone2', 'climb_intervals', 'threshold_intervals', 'vo2_intervals',
       'zone2_long'));

-- 2. Interval outputs -----------------------------------------------------------
alter table public.cardio_sessions
  add column if not exists interval_outputs smallint[];

alter table public.cardio_sessions
  drop constraint if exists cardio_sessions_interval_outputs_check,
  add constraint cardio_sessions_interval_outputs_check
    check (interval_outputs is null
      or (cardinality(interval_outputs) between 1 and 8
          and 0 <= all (interval_outputs)));

comment on column public.cardio_sessions.interval_outputs is
  'VO2 rides: average watts of each work interval, in order.';

-- 3. Settings -------------------------------------------------------------------
insert into public.training_settings
  (user_id, key, value, text_value, label, unit, group_name, sort_order)
select u.user_id, v.key, v.value, v.text_value, v.label, v.unit, v.group_name, v.sort_order
from (select distinct user_id from public.training_settings where deleted_at is null) u
cross join (values
  ('zone2_hr_low', 130::numeric, null::text,
   'Zone 2 heart rate, low end', 'bpm', 'Cardio', 10::smallint),
  ('zone2_hr_high', 145, null,
   'Zone 2 heart rate, high end (hard cap)', 'bpm', 'Cardio', 20),
  ('vo2_target_hr', 165, null,
   'VO2 intervals: heart rate by the end of each interval', 'bpm', 'Cardio', 30),
  ('cardio_plan_start', null, '2026-11-16',
   'Cardio plan week 1 (Monday, YYYY-MM-DD)', null, 'Cardio', 40),
  ('vo2_interval_minutes_by_week', null, '3,3,4,4,4,4',
   'VO2 work interval minutes by week (the last value holds)', null, 'Cardio', 50),
  ('long_ride_minutes_by_week', null, '60,65,70,75,80,90',
   'Saturday long Zone 2 minutes by week (the last value holds)', null, 'Cardio', 60),
  ('sprint_finisher_cleared', 0, null,
   'Sprint finisher cleared (1 = Thursday 4-6 x 20-30 s all-out)', null, 'Cardio', 70),
  ('sprint_finisher_from_week', 5, null,
   'Sprint finisher from cardio week', 'week', 'Cardio', 80),
  ('cardio_rules', null,
   E'Missed Saturday: do the long ride Sunday morning (Make up on the week list).\n'
   'Only 2 rides this week: keep Tue and Sat, drop Thu.\n'
   'Knee flare-up: Tue intervals become Zone 2 for the same minutes (automatic on a knee day off).',
   'Cardio fallback rules (one per line, shown on the program week)', null, 'Cardio', 90),
  ('calendar_long_ride_time', null, '07:00',
   'Calendar: Saturday long ride start', null, 'Calendar', 35)
) as v(key, value, text_value, label, unit, group_name, sort_order)
where not exists (
  select 1 from public.training_settings x
  where x.user_id = u.user_id and x.key = v.key and x.deleted_at is null
);
