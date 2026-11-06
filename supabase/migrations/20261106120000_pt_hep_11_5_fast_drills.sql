-- PT HEP: the 11/5 sheet (owner request 2026-11-06, week 12).
--
-- PT added fast-tempo drills and landing work, 3-4x a week, 3 x 10 each:
-- double heel raise, fast mini march, fast high march (one sheet item, two
-- drills), band march to the wall, drop squat. Scheduled on lift days
-- (Mon/Wed/Fri) to keep Tue/Thu/Sat/Sun as recovery days (v5.5 rule).
-- Category 'plyo' so the deload halves them. Drop squat shows only on a
-- normal knee check, like the Friday landing prep.
--
-- Additive and idempotent: exercises on conflict do nothing.

update public.program_sessions s
set structure = 'Home exercise program from PT (10/9 sheet at v5.5 doses, plus the 11/5 fast drills). Daily items every day; band work, step-down, mobs and the 11/5 drills on lift days.',
    updated_at = now()
from public.program_blocks b
where b.id = s.block_id
  and b.name in ('Block 1 Build', 'Block 2 Strength')
  and s.name = 'PT HEP' and s.session_type = 'accessory' and s.deleted_at is null
  and s.structure not like '%11/5%';

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, readiness_requirement,
   measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max, category, counts_as_quad_set, cue)
select s.user_id, s.id, x.ord, x.name, 'legs', x.readiness,
  'reps', 'bilateral', x.load_kind, 3, 3, 10, 10, 'plyo', false, x.cue
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.name in ('Block 1 Build', 'Block 2 Strength')
join (values
  (10, 'Double Heel Raise (Fast)', 'any', 'bodyweight',
     '11/5 sheet. Before the lift. Hand on a chair. Fast and quick up and down.'),
  (11, 'Fast Mini March', 'any', 'bodyweight',
     '11/5 sheet. Small knee lift, quick tempo throughout.'),
  (12, 'Fast High March', 'any', 'bodyweight',
     '11/5 sheet. Knee to hip height, quick tempo throughout.'),
  (13, 'Band March to Wall', 'any', 'band',
     '11/5 sheet. Band around the feet, hands on the wall, body at an angle. March toward the wall as fast as you can.'),
  (14, 'Drop Squat (Landing)', 'normal', 'bodyweight',
     '11/5 sheet. Rise on the toes, drop fast into a quarter squat and stick it. Quiet landing, knees over toes, even weight. Only on a normal knee check.')
) as x (ord, name, readiness, load_kind, cue) on true
where s.name = 'PT HEP' and s.session_type = 'accessory' and s.deleted_at is null
  and s.day_of_week in (1, 3, 5)
on conflict (program_session_id, exercise_order) do nothing;
