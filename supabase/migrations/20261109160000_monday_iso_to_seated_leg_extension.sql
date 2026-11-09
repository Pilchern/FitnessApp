-- Monday Block 1 "Legs + Push": the Isometric Knee Extension (strap, crane)
-- added in v2.18 comes out (owner 2026-11-09: the strap setup does not suit
-- him; the new bench's leg developer is in). Seated Leg Extension (90→45°)
-- takes its B2 slot, same row as Friday: 3 per leg x 10-15, RIR 2, plus one
-- left set, counts as a quad set, load_kind plate. Order 19 (18 stays with
-- the soft-deleted isometric; the unique key includes deleted rows).
--
-- Needs the v2.18 code on main (reads load_kind 'plate').
-- Idempotent: insert checks by name; the soft delete needs the replacement.

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   rir_target, category, counts_as_quad_set, left_extra_sets, superset_group, superset_order, cue, notes)
select s.user_id, s.id, 19, 'Seated Leg Extension (90→45°)', 'legs', 'quads',
  'any', 'reps', 'per_leg', 'plate', 3, 3, 10, 15,
  2.0, 'accessory', true, 1, 'B', 2,
  'Slow 2-s lowering; thigh stays on the seat.',
  'Range 90→45° until ke_full_range gate (PT OK). Left first. Load steps 2.5 lb (leg_developer_step_lb).'
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.deleted_at is null and s.session_type = 'lift' and s.day_of_week = 1
  and b.name = 'Block 1 Build'
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null
      and x.exercise_name = 'Seated Leg Extension (90→45°)'
  )
on conflict (program_session_id, exercise_order) do nothing;

update public.program_exercises e
set deleted_at = now(), updated_at = now()
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null and s.session_type = 'lift' and s.day_of_week = 1
  and b.name = 'Block 1 Build'
  and e.deleted_at is null and e.exercise_name = 'Isometric Knee Extension (strap, crane)'
  and exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null
      and x.exercise_name = 'Seated Leg Extension (90→45°)'
  );
