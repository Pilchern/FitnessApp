-- Program v2.14 (owner request 2026-10-28): the Tue/Thu "Knee circuit" becomes
-- a core session. The PT home exercise program already covers balance and band
-- hip work, and the lift days alone give 27 hard quad sets a week in Block 1
-- and 22 in Blocks 2-3 (target 18-26), so the circuit's knee work is redundant.
--
-- Scope: Tue/Thu accessory sessions in blocks starting weeks 10-38 (Block 1
-- onward; the week 9 on-ramp is past). Deload blocks borrow these sessions.
-- The week 39+ injury-prevention session is not touched (Copenhagen stays
-- there for return to sport).
--
-- 1. Rename the session to "Core (any time)", 8-10 min.
-- 2. Soft-delete: Copenhagen Side Plank (short + long lever; medial knee load,
--    MCL sprain on the 10/16 PT note), Perturbation Balance (both), Bent-Knee
--    Calf Raise, Banded Lateral Walk, Banded Knee Extension.
-- 3. Dead Bug 2 -> 3 sets; from week 14 it is loaded (DB overhead or band).
-- 4. New Side Plank 2 x 30-45 s per side (order 22; 19-21 are taken, live or
--    soft-deleted).
-- 5. Remaining moves: one superset A: Dead Bug, Pallof Press (to week 18),
--    Side Plank, Suitcase Carry (from week 14).
-- Idempotent.

-- 1. Session ---------------------------------------------------------------------
update public.program_sessions s
set name = 'Core (any time)',
    notes = 'One circuit, 2 rounds (Dead Bug 3). Rest after each round.',
    structure = 'Anti-extension, anti-rotation, lateral, carry. Minimal rest. Any time of day; does not need to be before the ride.',
    minutes_min = 8,
    minutes_max = 10
from public.program_blocks b
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where b.id = s.block_id
  and b.deleted_at is null
  and b.sessions_from_block_id is null
  and b.start_week between 10 and 38
  and s.deleted_at is null
  and s.session_type = 'accessory'
  and s.day_of_week in (2, 4)
  and s.name is distinct from 'Core (any time)';

-- 2. Cut ---------------------------------------------------------------------------
update public.program_exercises e
set deleted_at = now()
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null
  and s.session_type = 'accessory'
  and s.day_of_week in (2, 4)
  and b.sessions_from_block_id is null
  and b.start_week between 10 and 38
  and e.deleted_at is null
  and (
    e.exercise_name like 'Copenhagen Side Plank%'
    or e.exercise_name like 'Perturbation Balance%'
    or e.exercise_name = 'Bent-Knee Calf Raise'
    or e.exercise_name = 'Banded Lateral Walk'
    or e.exercise_name like 'Banded Knee Extension%'
  );

-- 3. Dead Bug ----------------------------------------------------------------------
update public.program_exercises e
set sets_min = 3,
    sets_max = 3,
    superset_group = 'A',
    superset_order = 1,
    load_kind = case when b.start_week >= 14 then 'dumbbell' else 'bodyweight' end,
    notes = case when b.start_week >= 14
      then 'Loaded: hold one light DB overhead with both hands (or band-resisted). 3 s exhale at full reach.'
      else 'Slow; 3 s exhale at full reach. Load it from week 14.' end
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null
  and s.session_type = 'accessory'
  and s.day_of_week in (2, 4)
  and b.sessions_from_block_id is null
  and b.start_week between 10 and 38
  and e.deleted_at is null
  and e.exercise_name = 'Dead Bug';

-- 4. Side Plank --------------------------------------------------------------------
insert into public.program_exercises (
  user_id, program_session_id, exercise_order, exercise_name, block_part,
  category, counts_as_quad_set, cue, notes, primary_muscle,
  readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max,
  seconds_target, superset_group, superset_order
)
select s.user_id, s.id, 22, 'Side Plank', 'legs',
  'core', false,
  'Elbow under shoulder, hips stacked and high, body straight. Knees bent to regress.',
  '30 s per side to start; add 5 s a week to 45 s.',
  'core', 'any', 'time', 'per_side', 'bodyweight', 2, 2,
  30, 'A', 3
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.deleted_at is null
  and s.session_type = 'accessory'
  and s.day_of_week in (2, 4)
  and b.sessions_from_block_id is null
  and b.start_week between 10 and 38
on conflict (program_session_id, exercise_order) do nothing;

-- 5. Superset order for the rest ---------------------------------------------------
update public.program_exercises e
set superset_group = 'A',
    superset_order = case e.exercise_name when 'Pallof Press' then 2 else 4 end
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null
  and s.session_type = 'accessory'
  and s.day_of_week in (2, 4)
  and b.sessions_from_block_id is null
  and b.start_week between 10 and 38
  and e.deleted_at is null
  and e.exercise_name in ('Pallof Press', 'Suitcase Carry');

update public.training_programs
set version = 'program v2.14, 2026-10-28'
where is_active and deleted_at is null
  and version is distinct from 'program v2.14, 2026-10-28';
