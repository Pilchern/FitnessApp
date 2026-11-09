-- Program v2.18, part B: the new bench's leg developer (owner request
-- 2026-11-09). Apply AFTER the v2.18 code is on main: the code before it
-- rejects load_kind 'plate' when it reads the program. Part A
-- (20261109150000) must be applied first (it widens the check).
--
-- Friday Block 1 "Quad + Arms":
--   Banded Knee Extension (90→45°) out (soft delete).
--   Prone Leg Curl (single-leg) in as A3, the Friday hamstring curl.
--   Seated Leg Extension (90→45°) in as B3, the quad isolation slot.
-- Friday Block 2 "Plyos + Quad + Arms":
--   Banded Knee Extension (90→45°) out; Seated Leg Extension in as B2 next
--   to Close-Grip Bench. Gated on ke_full_range: full range once cleared,
--   else it runs as the 90→45° version (same name as Block 1, so its loads
--   carry over). Nordics unchanged.
--
-- Idempotent: inserts check by name first; the soft deletes need the
-- replacement in place.

create temp view v218b_sessions as
select s.id, s.user_id, b.name as block_name, s.day_of_week
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.deleted_at is null and s.session_type = 'lift' and s.day_of_week = 5;

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   rir_target, category, counts_as_quad_set, left_extra_sets, superset_group, superset_order, cue, notes)
select s.user_id, s.id, 15, 'Prone Leg Curl (single-leg)', 'legs', 'hamstrings',
  'any', 'reps', 'per_leg', 'plate', 3, 3, 8, 12,
  2.0, 'accessory', false, 1, 'A', 3,
  'Hips pressed into the pad; 2-s lowering.',
  'Friday hamstring curl on the bench''s leg developer. Left first. Load steps 2.5 lb (leg_developer_step_lb).'
from v218b_sessions s
where s.block_name = 'Block 1 Build'
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null
      and x.exercise_name = 'Prone Leg Curl (single-leg)'
  )
on conflict (program_session_id, exercise_order) do nothing;

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   rir_target, category, counts_as_quad_set, left_extra_sets, superset_group, superset_order, cue, notes)
select s.user_id, s.id, 35, 'Seated Leg Extension (90→45°)', 'legs', 'quads',
  'any', 'reps', 'per_leg', 'plate', 3, 3, 10, 15,
  2.0, 'accessory', true, 1, 'B', 3,
  'Slow 2-s lowering; thigh stays on the seat.',
  'Range 90→45° until ke_full_range gate (PT OK). Left first. Load steps 2.5 lb (leg_developer_step_lb).'
from v218b_sessions s
where s.block_name = 'Block 1 Build'
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null
      and x.exercise_name = 'Seated Leg Extension (90→45°)'
  )
on conflict (program_session_id, exercise_order) do nothing;

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   rir_target, gate_key, substitute_name, substitute_load_kind,
   category, counts_as_quad_set, left_extra_sets, superset_group, superset_order, cue, notes)
select s.user_id, s.id, 35, 'Seated Leg Extension (full range)', 'legs', 'quads',
  'any', 'reps', 'per_leg', 'plate', 3, 3, 10, 15,
  2.0, 'ke_full_range', 'Seated Leg Extension (90→45°)', 'plate',
  'accessory', true, 1, 'B', 2,
  'Slow 2-s lowering; thigh stays on the seat.',
  'Range: full range when ke_full_range is on, else 90→45°. Left first. Load steps 2.5 lb (leg_developer_step_lb).'
from v218b_sessions s
where s.block_name = 'Block 2 Strength'
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null
      and x.exercise_name like 'Seated Leg Extension%'
  )
on conflict (program_session_id, exercise_order) do nothing;

update public.program_exercises e
set deleted_at = now(), updated_at = now()
from v218b_sessions s
where e.program_session_id = s.id
  and s.block_name in ('Block 1 Build', 'Block 2 Strength')
  and e.deleted_at is null and e.exercise_name = 'Banded Knee Extension (90→45°)'
  and exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null
      and x.exercise_name like 'Seated Leg Extension%'
  );

drop view v218b_sessions;
