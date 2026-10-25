-- Program v2.10 (owner request 2026-10-25, after the DEXA showed a left-leg
-- lean deficit and below-average arm lean):
--
-- 1. program_exercises.left_extra_sets: extra sets for the left (operated)
--    leg only on per-leg work. The logger adds them after the L/R pairs.
-- 2. One extra left set on the unilateral lower work: step-ups, split
--    squat / RFESS, single-leg RDL, single-leg calf raise. There is no cuff
--    knee extension after week 9, so none is changed.
-- 3. Direct arm work to 8 sets a week each: Dumbbell Curl and Tricep
--    Extension 3 -> 4 sets; Hammer Curl 4 sets added to the triceps day's
--    superset; Tricep Pushdown (band) 4 sets added to the push day.
--
-- Future weeks only: every change is on blocks starting week 10 or later
-- (week 9, On-ramp, is the current week). Logged sessions, sets and session
-- outcomes are not touched. Deload blocks borrow these sessions, so they
-- inherit the change minus their usual one set.
--
-- Plain statements, idempotent: add column if not exists, updates that
-- converge, inserts with on conflict do nothing.

alter table public.program_exercises
  add column if not exists left_extra_sets smallint not null default 0
    check (left_extra_sets between 0 and 3);

-- 2. Extra left set ------------------------------------------------------------
update public.program_exercises e
set left_extra_sets = 1
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null
  and e.deleted_at is null
  and b.start_week >= 10
  and e.side_mode = 'per_leg'
  and e.exercise_name in (
    'DB Step-Up (12")',
    'Petersen Step-Up (4–6")',
    'Split Squat (to 90°)',
    'Rear-Foot-Elevated Split Squat (to 90°)',
    'DB Single-Leg RDL',
    'Single-Leg Calf Raise'
  )
  and e.left_extra_sets <> 1;

-- 3a. Existing arm rows to 4 sets ----------------------------------------------
update public.program_exercises e
set sets_min = 4, sets_max = 4
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.program_session_id = s.id
  and s.deleted_at is null
  and e.deleted_at is null
  and b.start_week >= 10
  and e.exercise_name in ('Dumbbell Curl', 'Tricep Extension')
  and (e.sets_min is distinct from 4 or e.sets_max is distinct from 4);

-- 3b. New arm rows: reps and RIR copied from the block's existing curl or
--     triceps row, so each block keeps its rep scheme. exercise_order skips
--     orders held by soft-deleted rows (the unique key includes them).
with plan (start_week, day_of_week, exercise_name, copy_from, exercise_order,
           superset_group, superset_order, load_kind, cue) as (
  values
    (10, 5, 'Hammer Curl', 'Dumbbell Curl', 43, 'D', 4, 'dumbbell', 'Neutral grip, no swing.'),
    (14, 5, 'Hammer Curl', 'Dumbbell Curl', 43, 'D', 4, 'dumbbell', 'Neutral grip, no swing.'),
    (19, 5, 'Hammer Curl', 'Dumbbell Curl', 35, 'C', 4, 'dumbbell', 'Neutral grip, no swing.'),
    (23, 5, 'Hammer Curl', 'Dumbbell Curl', 34, 'C', 4, 'dumbbell', 'Neutral grip, no swing.'),
    (28, 5, 'Hammer Curl', 'Dumbbell Curl', 34, 'C', 4, 'dumbbell', 'Neutral grip, no swing.'),
    (33, 5, 'Hammer Curl', 'Dumbbell Curl', 34, 'C', 4, 'dumbbell', 'Neutral grip, no swing.'),
    (39, 1, 'Hammer Curl', 'Dumbbell Curl', 34, 'C', 4, 'dumbbell', 'Neutral grip, no swing.'),
    (10, 1, 'Tricep Pushdown', 'Tricep Extension', 45, null, null, 'band', 'Band. Elbows pinned, full lockout.'),
    (14, 1, 'Tricep Pushdown', 'Tricep Extension', 42, 'D', 3, 'band', 'Band. Elbows pinned, full lockout.'),
    (19, 1, 'Tricep Pushdown', 'Tricep Extension', 42, 'D', 3, 'band', 'Band. Elbows pinned, full lockout.'),
    (23, 1, 'Tricep Pushdown', 'Tricep Extension', 42, 'D', 3, 'band', 'Band. Elbows pinned, full lockout.'),
    (28, 1, 'Tricep Pushdown', 'Tricep Extension', 55, null, null, 'band', 'Band. Elbows pinned, full lockout.'),
    (33, 1, 'Tricep Pushdown', 'Tricep Extension', 42, 'D', 3, 'band', 'Band. Elbows pinned, full lockout.'),
    (39, 4, 'Tricep Pushdown', 'Tricep Extension', 34, 'C', 3, 'band', 'Band. Elbows pinned, full lockout.')
),
target as (
  select pl.*, s.id as session_id, s.user_id, b.id as block_id
  from plan pl
  join public.training_programs p on p.is_active and p.deleted_at is null
  join public.program_blocks b
    on b.program_id = p.id and b.deleted_at is null and b.start_week = pl.start_week
    and b.sessions_from_block_id is null
  join public.program_sessions s
    on s.block_id = b.id and s.deleted_at is null and s.session_type = 'lift'
    and s.day_of_week = pl.day_of_week
),
source as (
  select distinct on (t.block_id, t.exercise_name)
    t.*, e.reps_min, e.reps_max, e.rir_target
  from target t
  join public.program_sessions s2 on s2.block_id = t.block_id and s2.deleted_at is null
  join public.program_exercises e
    on e.program_session_id = s2.id and e.deleted_at is null and e.exercise_name = t.copy_from
  order by t.block_id, t.exercise_name, e.exercise_order
)
insert into public.program_exercises (
  user_id, program_session_id, exercise_order, exercise_name, block_part,
  category, counts_as_quad_set, cue, primary_muscle, readiness_requirement,
  measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
  rir_target, superset_group, superset_order
)
select user_id, session_id, exercise_order, exercise_name, 'upper',
  'accessory', false, cue, null, 'any',
  'reps', 'bilateral', load_kind, 4, 4, reps_min, reps_max,
  rir_target, superset_group, superset_order
from source
on conflict (program_session_id, exercise_order) do nothing;

update public.training_programs
set version = 'program v2.10, 2026-10-25'
where is_active and deleted_at is null
  and version is distinct from 'program v2.10, 2026-10-25';
