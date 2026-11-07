-- Friday lifts: the isometric knee extension (60° / 90°, crane scale) is
-- replaced by a banded knee extension (owner request 2026-11-07).
--
-- Why: a max-effort test mid-lift (after landing drills and step-ups) is
-- setup-heavy and fatigued, which made the quad LSI noisy (51-84% in 10
-- days). The measurement moves to the Sunday crane test (knee test form,
-- fresh). The Friday slot stays open-chain quad work for the left leg, the
-- work that closes the LSI gap, since Blocks 2+ have no other.
--
-- One Banded Knee Extension (90→45°) per Friday lift session that had an
-- isometric: 3 x 20-25 per leg, plus 1 extra left set, same prescription as
-- Monday's. Order 22 (the unique key includes soft-deleted rows). The
-- isometric rows are soft-deleted; logged history is untouched.
--
-- Idempotent: inserts only where the session has no banded knee extension;
-- the soft delete only touches live isometric rows.

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   rir_target, tempo, category, counts_as_quad_set, left_extra_sets, cue, notes)
select distinct on (e.program_session_id)
  e.user_id, e.program_session_id, 22, 'Banded Knee Extension (90→45°)', 'legs', 'quads',
  'any', 'reps', 'per_leg', 'band', 3, 3, 20, 25,
  1.0, '3 s lowering', 'accessory', true, 1,
  'Slow 2-s lowering; thigh stays down.',
  'Friday open-chain quad slot (replaced the isometric 11/7; strength is measured by the Sunday crane test). Bench edge or chair, heavy band ankle to the rack behind you. Stop at 45° until the full-range gate clears. Close to failure. Progress: reps to 25, then a heavier band. Left first.'
from public.program_exercises e
join public.program_sessions s on s.id = e.program_session_id
  and s.deleted_at is null and s.day_of_week = 5 and s.session_type = 'lift'
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.deleted_at is null
  and e.exercise_name like 'Isometric Knee Extension%'
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = e.program_session_id
      and x.exercise_name like 'Banded Knee Extension%' and x.deleted_at is null
  )
order by e.program_session_id, e.exercise_order
on conflict (program_session_id, exercise_order) do nothing;

update public.program_exercises e
set deleted_at = now(), updated_at = now()
from public.program_sessions s, public.program_blocks b, public.training_programs p
where s.id = e.program_session_id and s.deleted_at is null
  and s.day_of_week = 5 and s.session_type = 'lift'
  and b.id = s.block_id and b.deleted_at is null
  and p.id = b.program_id and p.is_active and p.deleted_at is null
  and e.deleted_at is null
  and e.exercise_name like 'Isometric Knee Extension%'
  and exists (
    select 1 from public.program_exercises x
    where x.program_session_id = e.program_session_id
      and x.exercise_name like 'Banded Knee Extension%' and x.deleted_at is null
  );
