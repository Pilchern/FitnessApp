-- PT Tracker absorb, phase 2 (owner request 2026-11-03).
--
-- 1. program_gates: who cleared a gate (cleared_by) and the criteria in
--    words. Status is not stored: it is derived (cleared_on set and on or
--    before today = cleared; else ready when every criterion on the gate
--    dashboard passes; else not yet), so it can never drift from the data.
-- 2. "PT HEP": the PT Tracker's active home exercise program (v5.5, 10/29)
--    as one accessory session a day in Block 1 (weeks 10-12, borrowed by the
--    week 13 deload) and Block 2 (weeks 14-17, borrowed by week 18). Daily
--    items every day; band side step, speed skaters, forward step-down and
--    patellar mobs on lift days (Mon/Wed/Fri) only. Accessory sessions are
--    not counted in adherence. Re-prescribe when PT changes the program.
--
-- Additive and idempotent: add column if not exists, criteria only where
-- null, sessions only where missing, exercises on conflict do nothing.

alter table public.program_gates
  add column if not exists cleared_by text
    check (cleared_by is null or cleared_by in ('pt', 'ortho', 'self_criteria')),
  add column if not exists criteria text
    check (criteria is null or char_length(criteria) <= 1000);

update public.program_gates set criteria =
  'Quad LSI 70%+ (crane, 90°); full extension; heel-to-butt L within 2 cm of R; swelling trace or less and graft pain 2 or less on the last 3 knee checks; walking asymmetry under target; on or after the earliest date; PT or ortho OK.'
where gate_key = 'jog' and criteria is null and deleted_at is null;

update public.program_gates set criteria =
  'Quad LSI 80%+; step-down clean on the left; single-leg sit-to-stand LSI 80%+; swelling trace or less and graft pain 2 or less on the last 3 knee checks; on or after the earliest date; PT or ortho OK.'
where gate_key in ('plyo_double', 'plyo_single') and criteria is null and deleted_at is null;

update public.program_gates set criteria =
  'Quad LSI 90%+; left H:Q at or above right; single, triple, crossover and 6 m timed hop LSI 90%+; ACL-RSI 80%+; walking asymmetry under target; on or after the earliest date; surgeon and PT clearance.'
where gate_key = 'rts' and criteria is null and deleted_at is null;

-- 2. PT HEP sessions ---------------------------------------------------------
insert into public.program_sessions
  (user_id, block_id, day_of_week, sort_order, session_type, name, minutes_min, minutes_max, structure, notes)
select b.user_id, b.id, d.dow, 9, 'accessory', 'PT HEP', 10, 20,
  'Home exercise program from PT (10/9 sheet, v5.5 doses). Daily items every day; band work, step-down and patellar mobs on lift days.',
  'Spanish squat hold 4 x 30-45 s before a lift only if the kneecap hurts (optional). Skip the forward step-down on a day with pain beneath the kneecap.'
from public.program_blocks b
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
cross join (values (0), (1), (2), (3), (4), (5), (6)) as d (dow)
where b.deleted_at is null
  and b.name in ('Block 1 Build', 'Block 2 Strength')
  and not exists (
    select 1 from public.program_sessions s
    where s.block_id = b.id and s.day_of_week = d.dow and s.name = 'PT HEP' and s.deleted_at is null
  );

-- (order, name, lift days only, measure, side_mode, load_kind, sets, reps, seconds, meters, cue)
insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, readiness_requirement,
   measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max, seconds_target,
   distance_meters_target, category, counts_as_quad_set, cue)
select s.user_id, s.id, x.ord, x.name, 'legs', 'any',
  x.measure, x.side_mode, x.load_kind, x.sets, x.sets, x.reps, x.reps, x.secs,
  x.meters, 'mobility', false, x.cue
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.name in ('Block 1 Build', 'Block 2 Strength')
join (values
  (1, 'Extension Check', false, 'time', 'bilateral', 'bodyweight', 1, null::smallint, 60::smallint, null::smallint,
     'Heel on a block, relax 1 minute. Knee as flat as the right one? Done. If not, hang 10 minutes and tell PT.'),
  (2, 'Heel Slides', false, 'reps', 'bilateral', 'bodyweight', 1, 10::smallint, null, null,
     'Left leg. 10-30 s overpressure hold on the last rep. Keep until heel-to-butt is within 2 cm of the right.'),
  (3, 'One Leg Stand', false, 'time', 'bilateral', 'bodyweight', 3, null, 30::smallint, null,
     'Operated leg, 30-60 s. Eyes open, then eyes closed or on a pillow once 60 s is easy.'),
  (4, 'Touch Step', false, 'reps', 'bilateral', 'bodyweight', 2, 10::smallint, null, null,
     'Left leg on the step edge. Lower the other foot toward the floor without touching. Fast up, slow lower.'),
  (5, 'Knee Extension with Band (TKE)', false, 'reps', 'bilateral', 'band', 2, 15::smallint, null, null,
     'Band anchored to a door, just above the knee. Tighten the quad to straighten against it. Hold 3 s. No hip sway.'),
  (6, 'Band Side Step', true, 'distance', 'bilateral', 'band', 3, null, null, 4::smallint,
     'In the lift warm-up. Band at the knees, ankles if easy. 10-15 ft each way.'),
  (7, 'Speed Skaters (Band)', true, 'distance', 'bilateral', 'band', 3, null, null, 4::smallint,
     'In the lift warm-up. Band at the ankles. Step forward and out, feet together, then the other side. 10-15 ft each way.'),
  (8, 'Forward Step-Down', true, 'reps', 'bilateral', 'bodyweight', 2, 10::smallint, null, null,
     'After the main lifts. Step down leading with the right leg, slow, knee over the second toe. Skip with pain beneath the kneecap.'),
  (9, 'Scar and Patellar Mobs', true, 'time', 'bilateral', 'bodyweight', 1, null, 180::smallint, null,
     'Lift and PT days. 3 minutes. Until PT says the kneecap moves normally.')
) as x (ord, name, lift_only, measure, side_mode, load_kind, sets, reps, secs, meters, cue)
  on (not x.lift_only or s.day_of_week in (1, 3, 5))
where s.name = 'PT HEP' and s.session_type = 'accessory' and s.deleted_at is null
on conflict (program_session_id, exercise_order) do nothing;
