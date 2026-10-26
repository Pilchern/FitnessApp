-- Program v2.11 (owner request 2026-10-26): barbell good mornings, light.
--
-- PT cleared barbell work (the `barbell` gate was cleared 2026-10-26 in
-- Settings, which also swaps Monday's goblet box squat for the barbell pin
-- squat) and has the owner doing 15 lb good mornings at PT. Added as the
-- third exercise of Wednesday's B superset in Block 1 (weeks 10-12) and
-- Block 2 (weeks 14-17), so their deloads (13, 18) carry it too: 3 x 10-12 @
-- RIR 3, behind the barbell gate. From Block 3 Wednesday already has
-- single-leg RDLs and the heavy back squat arrives, so it stops there.
--
-- Future weeks only; logged sets and outcomes untouched. Idempotent: insert
-- on conflict do nothing (orders 23 and 22 are free, live or soft-deleted).

with plan (start_week, exercise_order, superset_order) as (
  values (10, 23, 3), (14, 22, 3)
)
insert into public.program_exercises (
  user_id, program_session_id, exercise_order, exercise_name, block_part,
  category, counts_as_quad_set, cue, primary_muscle, readiness_requirement,
  measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
  rir_target, gate_key, superset_group, superset_order
)
select s.user_id, s.id, pl.exercise_order, 'Good Morning', 'legs',
  'accessory', false,
  'Bar on the upper back, soft knees, hips back to a hamstring stretch, flat back. Start at the 15 lb PT used; add 5 lb only when every set is RIR 3 or easier.',
  'hamstrings', 'any',
  'reps', 'bilateral', 'barbell', 3, 3, 10, 12,
  3, 'barbell', 'B', pl.superset_order
from plan pl
join public.training_programs p on p.is_active and p.deleted_at is null
join public.program_blocks b
  on b.program_id = p.id and b.deleted_at is null
  and b.start_week = pl.start_week and b.sessions_from_block_id is null
join public.program_sessions s
  on s.block_id = b.id and s.deleted_at is null
  and s.session_type = 'lift' and s.day_of_week = 3
on conflict (program_session_id, exercise_order) do nothing;

update public.training_programs
set version = 'program v2.11, 2026-10-26'
where is_active and deleted_at is null
  and version is distinct from 'program v2.11, 2026-10-26';
