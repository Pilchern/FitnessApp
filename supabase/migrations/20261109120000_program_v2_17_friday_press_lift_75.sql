-- Program v2.17 (owner request 2026-11-09).
--
-- 1. Dumbbell Shoulder Press comes out of every Friday lift that has it:
--    "Quad + Arms" (On-ramp and Block 1) and "Plyos + Quad + Arms"
--    (Block 2). Monday's press (Block 3 on) is untouched. Each superset it
--    sat in keeps 2-3 partners, so nothing is orphaned; the partners'
--    superset_order is renumbered so the labels read D1, D2, D3 without a
--    gap. No new pairings.
-- 2. Lift time cap 65 -> 75 min (flag and calendar), and the program rule
--    line for lift days says so. Every other rule line is unchanged.
--
-- The pogo gate needs no change: program_gates already has it cleared
-- 2026-11-05 by PT.
--
-- Idempotent: the soft delete only touches live rows, the renumber is a
-- no-op once contiguous, the settings updates only fire on the old values.

update public.program_exercises e
set deleted_at = now(), updated_at = now()
from public.program_sessions s, public.program_blocks b, public.training_programs p
where s.id = e.program_session_id and s.deleted_at is null
  and s.day_of_week = 5 and s.session_type = 'lift'
  and s.name in ('Quad + Arms', 'Plyos + Quad + Arms')
  and b.id = s.block_id and b.deleted_at is null
  and p.id = b.program_id and p.is_active and p.deleted_at is null
  and e.deleted_at is null
  and e.exercise_name = 'Dumbbell Shoulder Press';

with friday as (
  select s.id
  from public.program_sessions s
  join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
  join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
  where s.deleted_at is null and s.day_of_week = 5 and s.session_type = 'lift'
    and s.name in ('Quad + Arms', 'Plyos + Quad + Arms')
),
renumbered as (
  select e.id,
         row_number() over (
           partition by e.program_session_id, e.superset_group
           order by e.superset_order, e.exercise_order
         ) as new_order
  from public.program_exercises e
  where e.program_session_id in (select id from friday)
    and e.deleted_at is null
    and e.superset_group is not null
)
update public.program_exercises e
set superset_order = r.new_order, updated_at = now()
from renumbered r
where e.id = r.id and e.superset_order is distinct from r.new_order;

update public.training_settings
set value = 75, updated_at = now()
where deleted_at is null
  and key in ('lift_session_max_minutes', 'calendar_lift_minutes')
  and value = 65;

update public.training_settings
set text_value = replace(
      text_value,
      'Lift days: 60-75 min, at most 4 upper-body movements.',
      'Lift days: cap 75 min, at most 4 upper-body movements. Arm volume stays at 4 sets.'
    ),
    updated_at = now()
where deleted_at is null
  and key = 'program_rules'
  and position('Lift days: 60-75 min, at most 4 upper-body movements.' in text_value) > 0;
