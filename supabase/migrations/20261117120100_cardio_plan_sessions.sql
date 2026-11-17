-- Cardio plan, part B (owner request 2026-11-17): the ride sessions.
-- Apply AFTER the code from this change is live in production (older code
-- rejects ride_kind 'zone2_long' on read). Part A must already be applied.
--
-- Scope: the active program's blocks with their own sessions from week 13
-- through Strength A2 (start weeks 13, 14, 19, 23, 28, 33). The deloads and
-- the taper borrow those sessions, so they follow. Return to Sport (39+) is
-- not touched. Lifts, core, PT HEP, mobs and walk-jog are not touched.
--
--  1. Zone 2 rides: heart rate numbers come out of the text (Settings holds
--     the band now).
--  2. Week 13 exception: Tue stays Zone 2 45 (done 11/17); Thu becomes the
--     VO2 interval ride (4 x 3 min from the progression).
--  3. From week 14: Tue = VO2 intervals, Thu = Zone 2 45 min.
--  4. Saturday: long Zone 2 ('zone2_long'), no gate; minutes from the
--     progression (60, 65, 70, 75, 80, 90, then 90).
--  5. Sunday optional Zone 2 ride: soft-deleted (Sunday is off, walk only).
--  6. Gate intervals: cleared 2026-11-17 (owner: cleared for hard efforts).
--  7. program_rules Zone 2 line points at Settings; program version.
--
-- In place updates on future session rows; logged rides are untouched.
-- Idempotent: each update matches only the old shape.

create temp view cp_sessions as
select s.id, s.day_of_week, b.start_week
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.deleted_at is null and s.session_type = 'peloton'
  and b.start_week in (13, 14, 19, 23, 28, 33);

-- 1. Zone 2 text --------------------------------------------------------------
update public.program_sessions
set structure = 'Seated, cadence 85 to 90. Hold watts; add 5 W when HR at those watts falls 5+ bpm for 2 weeks.',
    updated_at = now()
where id in (select id from cp_sessions where day_of_week = 2)
  and ride_kind = 'zone2'
  and structure like 'Zone 2: 125 to 132 bpm%';

-- 2. Week 13 Thursday: VO2 intervals -------------------------------------------
update public.program_sessions
set name = 'Peloton VO2 intervals', ride_kind = 'vo2_intervals',
    gate_key = 'intervals', minutes_min = 36, minutes_max = 36,
    structure = null, updated_at = now()
where id in (select id from cp_sessions where day_of_week = 4 and start_week = 13)
  and ride_kind = 'threshold_intervals';

-- 3. From week 14: Tue VO2, Thu Zone 2 45 ----------------------------------------
update public.program_sessions
set name = 'Peloton VO2 intervals', ride_kind = 'vo2_intervals',
    gate_key = 'intervals', minutes_min = 43, minutes_max = 43,
    structure = null, updated_at = now()
where id in (select id from cp_sessions where day_of_week = 2 and start_week >= 14)
  and ride_kind = 'zone2';

update public.program_sessions
set name = 'Peloton Zone 2', ride_kind = 'zone2', gate_key = null,
    minutes_min = 45, minutes_max = 45,
    structure = 'Seated, cadence 85 to 90. Hold watts; add 5 W when HR at those watts falls 5+ bpm for 2 weeks.',
    updated_at = now()
where id in (select id from cp_sessions where day_of_week = 4 and start_week >= 14)
  and ride_kind in ('threshold_intervals', 'vo2_intervals');

-- 4. Saturday long Zone 2 --------------------------------------------------------
update public.program_sessions
set name = 'Peloton long Zone 2', ride_kind = 'zone2_long', gate_key = null,
    minutes_min = 60, minutes_max = 60,
    structure = 'Seated, cadence 85 to 90, 7:00 AM. Steady the whole ride.',
    updated_at = now()
where id in (select id from cp_sessions where day_of_week = 6)
  and ride_kind = 'threshold_intervals';

-- 5. Sunday off ------------------------------------------------------------------
update public.program_sessions
set deleted_at = now(), updated_at = now()
where id in (select id from cp_sessions where day_of_week = 0)
  and name = 'Peloton Zone 2 (easy, optional)';

-- 6. Intervals gate --------------------------------------------------------------
update public.program_gates
set cleared_on = '2026-11-17',
    notes = 'Owner 2026-11-17: cleared for hard efforts.',
    updated_at = now()
where deleted_at is null and gate_key = 'intervals' and cleared_on is null;

-- 7. Rules and version -----------------------------------------------------------
update public.training_settings
set text_value = replace(text_value,
      'Zone 2: 150 min a week at 125 to 132 bpm, cap 135.',
      'Zone 2: heart rate band and cap in Settings › Cardio. Rides: Tue VO2 intervals, Thu Zone 2 45, Sat long Zone 2; Sunday off.'),
    updated_at = now()
where deleted_at is null and key = 'program_rules'
  and position('Zone 2: 150 min a week at 125 to 132 bpm, cap 135.' in coalesce(text_value, '')) > 0;

update public.training_programs
set version = 'program v2.21, 2026-11-17', updated_at = now()
where is_active and deleted_at is null
  and version is distinct from 'program v2.21, 2026-11-17';

drop view cp_sessions;
