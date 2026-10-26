-- Program v2.13 (owner request 2026-10-26): core work back on the Tuesday and
-- Thursday accessory circuits, now that barbell squats and good mornings are
-- in. A muscle-group audit found the only core work left was the Copenhagen
-- side plank (lateral); nothing for anti-extension or anti-rotation.
--
-- 1. Dead Bug 2 x 10 per side, restored (soft-deleted 2026-10-21) in every
--    block from week 10 to 38, and now runs every week (it stopped at week
--    13 before).
-- 2. Suitcase Carry 2 x 30 m per side from week 14, restored (soft-deleted
--    2026-10-21), as the plan doc lists it.
-- 3. Pallof Press 2 x 10 per side, weeks 10-18, new. From week 19 Band
--    Step-and-Rotate (and Med Ball Scoop Toss once gated in) cover rotation.
--
-- Deload blocks borrow these sessions, so they get them too. The week 39+
-- block has its own Saturday Suitcase Carry and is not touched. Future weeks
-- only. Idempotent: updates converge, insert on conflict do nothing (order 19
-- is free, live or soft-deleted).

-- 1 + 2. Restore ------------------------------------------------------------------
update public.program_exercises e
set deleted_at = null,
    until_week = case when e.exercise_name = 'Dead Bug' then null else e.until_week end
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null
  and s.session_type = 'accessory'
  and s.day_of_week in (2, 4)
  and b.sessions_from_block_id is null
  and b.start_week between 10 and 38
  and (
    (e.exercise_order = 14 and e.exercise_name = 'Dead Bug')
    or (e.exercise_order = 15 and e.exercise_name = 'Suitcase Carry')
  )
  and (e.deleted_at is not null
    or (e.exercise_name = 'Dead Bug' and e.until_week is not null));

-- 3. Pallof Press, weeks 10-18 -----------------------------------------------------
insert into public.program_exercises (
  user_id, program_session_id, exercise_order, exercise_name, block_part,
  until_week, category, counts_as_quad_set, cue, primary_muscle,
  readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max,
  reps_min, reps_max
)
select s.user_id, s.id, 19, 'Pallof Press', 'legs',
  18, 'core', false,
  'Half-kneel on the right knee or stand. Press out, hold 2 s; don''t let the band turn you.',
  'core', 'any', 'reps', 'per_side', 'band', 2, 2, 10, 10
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.deleted_at is null
  and s.session_type = 'accessory'
  and s.day_of_week in (2, 4)
  and b.sessions_from_block_id is null
  and b.start_week in (10, 14)
on conflict (program_session_id, exercise_order) do nothing;

update public.training_programs
set version = 'program v2.13, 2026-10-26'
where is_active and deleted_at is null
  and version is distinct from 'program v2.13, 2026-10-26';
