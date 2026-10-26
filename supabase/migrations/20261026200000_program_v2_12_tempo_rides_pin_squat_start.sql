-- Program v2.12 (owner request 2026-10-26, after the barbell clearance review):
--
-- 1. Block 1 Thursday ride (weeks 10-12, deload 13 borrows it): the climb
--    intervals at cadence 60-70 become seated tempo at cadence 85-95. Low
--    cadence, high torque work loads the patellar tendon, the graft donor
--    site, so the first step past Zone 2 is spin, not grind. ride_kind stays
--    'climb_intervals' (the check constraint); the app labels it "Tempo
--    intervals".
-- 2. Block 2 Thursday 4 x 4: seated, cadence 80 or higher.
-- 3. Block 1 Monday Barbell Pin Squat: the cue sets the first barbell session
--    at the empty bar (45 lb), stopping at RIR 3, with a swelling back-off.
-- 4. Block 1 Friday: Slider Hamstring Curl off (soft delete). Wednesday has
--    sliders plus good mornings, and Friday was 13 exercises.
--
-- The `intervals` gate still decides when the Thursday rides run; until it
-- is cleared they show as seated Zone 2. Future weeks only; logged sets and
-- outcomes untouched. Updates converge, so the file is safe to rerun.

-- 1. Block 1 tempo ride ---------------------------------------------------------
update public.program_sessions s
set name = 'Peloton tempo intervals',
    structure = '10 min warm-up; 4 x 4 min seated tempo, cadence 85–95, RPE 6, 3 min easy between; cool-down. After two weeks with no next-morning swelling: 3 x 8 min at RPE 7, same cadence.'
from public.program_blocks b
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.block_id = b.id
  and b.deleted_at is null
  and b.start_week = 10
  and b.sessions_from_block_id is null
  and s.deleted_at is null
  and s.session_type = 'peloton'
  and s.ride_kind = 'climb_intervals'
  and s.name is distinct from 'Peloton tempo intervals';

-- 2. Block 2 cadence floor ------------------------------------------------------
update public.program_sessions s
set structure = '10 min warm-up; 4 x 4 min seated at RPE 8, cadence 80 or higher, 3 min easy between; cool-down.'
from public.program_blocks b
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.block_id = b.id
  and b.deleted_at is null
  and b.start_week = 14
  and b.sessions_from_block_id is null
  and s.deleted_at is null
  and s.session_type = 'peloton'
  and s.ride_kind = 'threshold_intervals'
  and s.structure is distinct from '10 min warm-up; 4 x 4 min seated at RPE 8, cadence 80 or higher, 3 min easy between; cool-down.';

-- 3. Pin squat first session ----------------------------------------------------
update public.program_exercises e
set cue = 'Pins at 90°. Touch, don''t bounce. First barbell session: empty bar (45 lb), stop at RIR 3. If next-morning swelling is worse than trace, go back to the goblet box squat for a week.'
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null
  and e.deleted_at is null
  and b.start_week = 10
  and s.day_of_week = 1
  and e.exercise_name = 'Barbell Pin Squat (to 90°)'
  and e.cue is distinct from 'Pins at 90°. Touch, don''t bounce. First barbell session: empty bar (45 lb), stop at RIR 3. If next-morning swelling is worse than trace, go back to the goblet box squat for a week.';

-- 4. Friday slider curl off -----------------------------------------------------
update public.program_exercises e
set deleted_at = now()
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null
  and e.deleted_at is null
  and b.start_week = 10
  and s.day_of_week = 5
  and s.session_type = 'lift'
  and e.exercise_name = 'Slider Hamstring Curl';

update public.training_programs
set version = 'program v2.12, 2026-10-26'
where is_active and deleted_at is null
  and version is distinct from 'program v2.12, 2026-10-26';
