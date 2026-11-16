-- Program v2.20 (owner request 2026-11-16): no cable work, bands only where
-- needed. Equipment is barbell, dumbbells, bench/leg developer, rack and a
-- few bands; there is no cable stack.
--
-- Data only: no column, constraint or enum changes. Logged history is not
-- touched (logs keep their own exercise names). Scope is week 13 and every
-- later block of the active program; Block 1 and the on-ramp are history.
-- Rows are renamed in place so they keep their session, order, superset
-- slot and sets/reps.
--
--  1. Overhead Cable Triceps Extension (Monday, 4 x 10-15) -> Dumbbell
--     Skull Crusher. Friday already runs the overhead DB extension, so
--     Monday takes the lying variant.
--  2. Face Pull (band, Wednesday) -> Chest-Supported Rear Delt Fly (DB).
--  3. Pallof Press (band, core after ride) -> Dumbbell Plank Pull-Through.
--  4. Band Step-and-Rotate (golf prep, weeks 19-33) -> Standing Dumbbell
--     Woodchop.
--  5. Core session structure text and program_rules: Pallof -> plank
--     pull-through.
--  6. Program version.
--
-- Bands that stay: the PT HEP drills (TKE, band side step, speed skaters,
-- band march; PT's prescription), Banded Lateral Walk and the band-assisted
-- Nordic in the Return to Sport injury-prevention session.
--
-- Idempotent: every update matches on the old name only.

create temp view v220_rows as
select e.id
from public.program_exercises e
join public.program_sessions s on s.id = e.program_session_id and s.deleted_at is null
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where e.deleted_at is null and b.start_week >= 13;

-- 1. Triceps ----------------------------------------------------------------
update public.program_exercises
set exercise_name = 'Dumbbell Skull Crusher',
    load_kind = 'dumbbell',
    cue = 'Flat bench, elbows up and slightly back; lower the DBs beside the head, full stretch, full lockout.',
    updated_at = now()
where id in (select id from v220_rows)
  and exercise_name = 'Overhead Cable Triceps Extension';

-- 2. Rear delts -------------------------------------------------------------
update public.program_exercises
set exercise_name = 'Chest-Supported Rear Delt Fly',
    load_kind = 'dumbbell',
    cue = 'Chest on the bench at 30-45°, light DBs, lead with the elbows, squeeze the rear delts; no shrug.',
    updated_at = now()
where id in (select id from v220_rows)
  and exercise_name = 'Face Pull';

-- 3. Anti-rotation core -----------------------------------------------------
update public.program_exercises
set exercise_name = 'Dumbbell Plank Pull-Through',
    load_kind = 'dumbbell',
    cue = 'High plank, feet wide; drag the DB under you to the other side without the hips turning.',
    updated_at = now()
where id in (select id from v220_rows)
  and exercise_name = 'Pallof Press';

-- 4. Rotation (golf prep) ---------------------------------------------------
update public.program_exercises
set exercise_name = 'Standing Dumbbell Woodchop',
    load_kind = 'dumbbell',
    cue = 'One DB in both hands, high to low across the body; turn through the hips, not the knee.',
    updated_at = now()
where id in (select id from v220_rows)
  and exercise_name = 'Band Step-and-Rotate';

-- 5. Text -------------------------------------------------------------------
update public.program_sessions s
set structure = replace(s.structure, 'side plank, Pallof,', 'side plank, plank pull-through,'),
    updated_at = now()
from public.program_blocks b
where b.id = s.block_id and b.deleted_at is null and b.start_week >= 13
  and s.deleted_at is null
  and position('side plank, Pallof,' in coalesce(s.structure, '')) > 0;

update public.training_settings
set text_value = replace(text_value, 'side plank, Pallof,', 'side plank, plank pull-through,')
      || E'\nEquipment: no cables. Dumbbell or barbell first; bands only for the PT HEP drills.',
    updated_at = now()
where deleted_at is null and key = 'program_rules'
  and position('Equipment: no cables' in coalesce(text_value, '')) = 0;

-- 6. Version ----------------------------------------------------------------
update public.training_programs
set version = 'program v2.20, 2026-11-16', updated_at = now()
where is_active and deleted_at is null and version is distinct from 'program v2.20, 2026-11-16';

drop view v220_rows;
