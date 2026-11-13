-- Program v2.19 (owner request 2026-11-13; plan "Locked program v2.19").
--
-- Data only: no column, constraint or enum changes. Safe before the code
-- deploys. Soft delete only; logged history is not touched (logs keep their
-- own exercise names).
--
-- Scope: the week-13 deload ("Deload + Test") and every later block. Block 1
-- (weeks 10-12) is not edited: week 13 used to repeat Block 1's sessions, so
-- it now gets its own copy of the v2.19 week instead (it still points at
-- Block 1 for its scheme, so the prior-block load lookup keeps skipping it).
--
--  1. Gates: kneel_pain_free, bike_resistance_ceiling, adductor_ok (all
--     uncleared); ke_full_range relabelled; cutting and rts criteria text
--     (100% quad symmetry before cutting sports, 90% golf and running).
--  2. Settings: lift target 85 min, hard-stop warning 90; warm-up adds band
--     side step and speed skaters; program rules text.
--  3. Lift sessions, Blocks 2 / 3 / Strength A / Power B / Strength A2: the
--     v2.19 Mon/Wed/Fri template (superset groups, sets, isolation 10-15,
--     compounds keep the block's rep range). Removed: Petersen step-up,
--     tricep pushdown, Nordic, DB shoulder press, banded knee extension,
--     eccentric lateral step-down, med ball toss, Wednesday lateral raise.
--     Block plyos, power, cutting and golf drills stay; Power B keeps its
--     contrast pairs (jump next to its lift).
--  4. Block 2 accessories: PT HEP (morning) = the daily five; new Fast
--     drills (morning) Tue/Thu/Sat; new Scar and patellar mobs (evening).
--  5. Core (after ride) Tue/Thu, Blocks 2 to Strength A2: dead bug, side
--     plank, Pallof, Foundation Founder, short-lever Copenhagen (adductor_ok).
--  6. Rides: Block 2 Thursday 45 min; Saturday long ride gated on
--     bike_resistance_ceiling (seated Zone 2 until set).
--  7. Week 13: own copy of the Block 2 week, compounds at Block 1 reps,
--     Friday prep only (no locked plyo progressions).
--  8. Return to Sport block: removal list, pushdown -> overhead cable
--     triceps extension, isolation 10-15, Nordic gated on kneel_pain_free.
--  9. Program version.
--
-- exercise_order: the unique key (session, order) includes soft-deleted
-- rows. Every order used here is 56+ (the highest order in use was 55), so
-- nothing collides. Idempotent: updates set fixed values, inserts check
-- for a live row first.

-- Active program blocks and live sessions ------------------------------------
create temp view v219_sessions as
select s.id, s.user_id, s.block_id, b.name as block_name, b.program_id,
       s.day_of_week, s.session_type, s.name, s.sort_order
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.deleted_at is null;

-- Exercise attribute templates (snapshot before any edit): one live row per
-- name, preferring Block 2, then Block 1, never the settings-gated
-- Wednesday lateral raise.
create temp table v219_tpl as
select distinct on (e.exercise_name) e.*
from public.program_exercises e
join public.program_sessions s on s.id = e.program_session_id and s.deleted_at is null
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
where e.deleted_at is null
order by e.exercise_name,
         (e.gate_key is not distinct from 'shoulder_emphasis'),
         (b.start_week = 14) desc, (b.start_week = 10) desc,
         e.updated_at desc;

insert into v219_tpl (exercise_name, block_part, primary_muscle, readiness_requirement,
  measure, side_mode, load_kind, category, counts_as_quad_set, left_extra_sets, cue)
select 'Overhead Cable Triceps Extension', 'upper', null, 'any',
  'reps', 'bilateral', 'band', 'accessory', false, 0,
  'Face away from the anchor, elbows by the ears; full stretch, full lockout.'
where not exists (select 1 from v219_tpl where exercise_name = 'Overhead Cable Triceps Extension');

insert into v219_tpl (exercise_name, block_part, primary_muscle, readiness_requirement,
  measure, side_mode, load_kind, category, counts_as_quad_set, left_extra_sets, cue, gate_key)
select 'Copenhagen Side Plank (short lever)', t.block_part, 'adductors', 'any',
  'time', 'per_side', 'bodyweight', 'core', false, 0,
  'Knee on the bench (short lever), hips stacked, body straight.', 'adductor_ok'
from v219_tpl t
where t.exercise_name = 'Side Plank'
  and not exists (select 1 from v219_tpl where exercise_name = 'Copenhagen Side Plank (short lever)');

-- 1. Gates -------------------------------------------------------------------
insert into public.program_gates (user_id, gate_key, label, criteria)
select u.user_id, g.gate_key, g.label, g.criteria
from (select distinct user_id from public.program_gates where deleted_at is null) u
cross join (values
  ('kneel_pain_free', 'Kneeling pain-free (Nordics)',
   'PT confirms kneeling on the left knee is pain-free. Then Nordic curls replace the Wednesday prone leg curl (one-line program change).'),
  ('bike_resistance_ceiling', 'Bike resistance ceiling reached',
   'Zone 2 at cadence 85-90 needs resistance near the top of the usable range. Then the Saturday ride becomes 60 min with 2 x 15 min hard, steady.'),
  ('adductor_ok', 'Adductor OK for Copenhagen (PT)',
   'PT OK for adductor loading. Then the short-lever Copenhagen plank 2 x 20 s/side joins the core session.')
) as g(gate_key, label, criteria)
on conflict (user_id, gate_key) do nothing;

update public.program_gates
set label = 'Knee extension full range (90→0°)', updated_at = now()
where deleted_at is null and gate_key = 'ke_full_range'
  and label = 'Knee extension full range (90→0°, banded)';

update public.program_gates
set criteria = 'Quad symmetry 100% (crane LSI and the weekly single-leg leg extension) before cutting sports; PT or ortho OK.',
    updated_at = now()
where deleted_at is null and gate_key = 'cutting' and criteria is null;

update public.program_gates
set criteria = criteria || ' Quad symmetry: 90% for golf and running; 100% before cutting sports (cutting gate).',
    updated_at = now()
where deleted_at is null and gate_key = 'rts'
  and position('100% before cutting' in coalesce(criteria, '')) = 0;

-- 2. Settings ----------------------------------------------------------------
update public.training_settings
set value = 85, updated_at = now()
where deleted_at is null and key = 'calendar_lift_minutes' and value = 75;

update public.training_settings
set value = 90, label = 'Hard-stop warning: lift sessions over', updated_at = now()
where deleted_at is null and key = 'lift_session_max_minutes' and value = 75;

update public.training_settings
set text_value = text_value || '; band side step 1-2 sets; speed skaters 1-2 sets',
    updated_at = now()
where deleted_at is null and key = 'warm_up'
  and position('speed skaters' in lower(coalesce(text_value, ''))) = 0;

update public.training_settings
set text_value = replace(replace(replace(text_value,
      'Lift days: cap 75 min, at most 4 upper-body movements. Arm volume stays at 4 sets.',
      'Lift days: target 85 min, hard stop at 90. Arm volume stays at 4 sets. Isolation work 10-15 reps in every block.'),
      'Core 2x a week, any time of day (dead bug, Pallof, side plank; suitcase carry from week 14).',
      'Core Tue and Thu after the ride, 10 min (dead bug, side plank, Pallof, Foundation Founder; short-lever Copenhagen once adductor_ok is set).'),
      'Nordics only on a thick pad and only if the graft site tolerates it.',
      'Nordics only once kneel_pain_free is set, on a thick pad.')
    || E'\nKnee tests: single-leg leg extension every Sunday (same load each leg, reps to RIR 1, left first); crane isometric monthly.',
    updated_at = now()
where deleted_at is null and key = 'program_rules'
  and position('single-leg leg extension every Sunday' in coalesce(text_value, '')) = 0;

-- 3. Lift template -----------------------------------------------------------
-- kind: c = compound (block rep range), i = isolation (10-15), t = timed.
create temp table v219_lift (dow int, name text, ord int, grp text, pos int, sets int, kind text, cue text, notes text);
insert into v219_lift values
  (1, 'Barbell Back Squat (to parallel)', 100, 'A', 1, 4, 'c', null, null),
  (1, 'Lateral Raise', 102, 'A', 2, 3, 'i', null, null),
  (1, 'Barbell Bench Press', 110, 'B', 1, 3, 'c', null, null),
  (1, 'Seated Leg Extension (full range)', 111, 'B', 2, 4, 'i', '3-s lowering, bench reclined.',
     'Range 90→45° until ke_full_range clears, then full range. Counts as a quad set. Left first. Load steps 2.5 lb (leg_developer_step_lb).'),
  (1, 'Overhead Cable Triceps Extension', 112, 'B', 3, 4, 'i', null, null),
  (1, 'Barbell Hip Thrust', 120, 'C', 1, 3, 'c', null, null),
  (1, 'Single-Leg Calf Raise', 122, 'C', 2, 3, 'i', 'Standing. Full stretch off the plate, 1 s pause on top.', 'Off a plate, DB in hand. Left first.'),
  (1, 'Incline Dumbbell Press', 123, 'C', 3, 3, 'c', null, null),
  (3, 'Rear-Foot-Elevated Split Squat (to 90°)', 100, 'A', 1, 3, 'c', null, null),
  (3, 'Pull-Up', 102, 'A', 2, 4, 'c', null, null),
  (3, 'DB Step-Up (12")', 110, 'B', 1, 2, 'c', null, null),
  (3, 'Dumbbell Row', 111, 'B', 2, 4, 'c', null, null),
  (3, 'Good Morning', 120, 'C', 1, 3, 'c', null, null),
  (3, 'Face Pull', 121, 'C', 2, 3, 'i', null, null),
  (3, 'Prone Leg Curl (single-leg)', 130, 'D', 1, 3, 'i', null,
     'Leg developer. Left first. Load steps 2.5 lb (leg_developer_step_lb). Nordics replace this once kneel_pain_free is set.'),
  (3, 'Dumbbell Curl', 131, 'D', 2, 4, 'i', null, null),
  (3, 'Dead Hang', 140, null, null, 2, 't', null, null),
  (5, 'Front Squat', 100, 'A', 1, 3, 'c', null, null),
  (5, 'Chin-Up', 101, 'A', 2, 3, 'c', null, null),
  (5, 'Seated Leg Extension (full range)', 110, 'B', 1, 4, 'i', '3-s lowering, bench reclined.',
     'Range 90→45° until ke_full_range clears, then full range. Counts as a quad set. Left first. Load steps 2.5 lb (leg_developer_step_lb).'),
  (5, 'Close-Grip Bench Press', 111, 'B', 2, 3, 'c', null, null),
  (5, 'Prone Leg Curl (single-leg)', 120, 'C', 1, 3, 'i', null,
     'Leg developer. Left first. Load steps 2.5 lb (leg_developer_step_lb).'),
  (5, 'DB Single-Leg RDL', 121, 'C', 2, 2, 'c', null, null),
  (5, 'Tricep Extension', 130, 'D', 1, 4, 'i', null, 'Overhead DB.'),
  (5, 'Hammer Curl', 131, 'D', 2, 4, 'i', null, null),
  (5, 'Lateral Raise', 132, 'D', 3, 3, 'i', null, null);

-- Compound rep ranges per block (each block's current range; Block 1's for week 13).
create temp table v219_reps (blk text, name text, rmin int, rmax int);
insert into v219_reps
select b.blk, c.name, (b.r[c.i])[1], (b.r[c.i])[2]
from (values
  ('Deload + Test',         array[[10,12],[8,10],[10,12],[10,12],[10,12],[2,4],[10,12],[10,12],[10,12],[10,12],[3,5],[8,10],[10,10]]),
  ('Block 2 Strength',      array[[6,8],[5,7],[6,8],[8,10],[6,8],[4,6],[6,8],[8,10],[10,12],[6,8],[4,6],[6,8],[8,8]]),
  ('Block 3 Heavy + Power', array[[3,5],[3,5],[5,5],[6,8],[5,5],[3,5],[6,8],[6,8],[8,10],[4,6],[4,6],[5,6],[6,6]]),
  ('Strength A',            array[[4,6],[4,6],[4,6],[6,8],[4,6],[4,6],[6,8],[6,8],[8,10],[4,6],[4,6],[4,6],[6,6]]),
  ('Power B',               array[[3,3],[3,3],[3,3],[6,8],[3,3],[4,6],[6,8],[6,8],[8,10],[3,3],[4,6],[5,6],[6,6]]),
  ('Strength A2',           array[[3,5],[3,5],[5,5],[6,8],[3,5],[4,6],[6,8],[6,8],[8,10],[3,5],[4,6],[3,5],[6,6]])
) as b(blk, r)
cross join (values
  (1, 'Barbell Back Squat (to parallel)'), (2, 'Barbell Bench Press'), (3, 'Barbell Hip Thrust'),
  (4, 'Incline Dumbbell Press'), (5, 'Rear-Foot-Elevated Split Squat (to 90°)'), (6, 'Pull-Up'),
  (7, 'DB Step-Up (12")'), (8, 'Dumbbell Row'), (9, 'Good Morning'), (10, 'Front Squat'),
  (11, 'Chin-Up'), (12, 'Close-Grip Bench Press'), (13, 'DB Single-Leg RDL')
) as c(i, name);

create temp view v219_target_lifts as
select * from v219_sessions
where session_type = 'lift'
  and block_name in ('Block 2 Strength', 'Block 3 Heavy + Power', 'Strength A', 'Power B', 'Strength A2');

-- 3a. Kept rows: re-slot, sets, reps, cue/notes.
update public.program_exercises e
set exercise_order = l.ord,
    superset_group = l.grp,
    superset_order = l.pos,
    sets_min = l.sets,
    sets_max = l.sets,
    reps_min = case l.kind when 'i' then 10 when 'c' then r.rmin else e.reps_min end,
    reps_max = case l.kind when 'i' then 15 when 'c' then r.rmax else e.reps_max end,
    left_extra_sets = case when e.side_mode = 'per_leg' then 1 else e.left_extra_sets end,
    from_week = null,
    until_week = null,
    cue = coalesce(l.cue, e.cue),
    notes = coalesce(l.notes, e.notes),
    updated_at = now()
from v219_target_lifts s
join v219_lift l on l.dow = s.day_of_week
left join v219_reps r on r.blk = s.block_name and r.name = l.name
where e.program_session_id = s.id and e.deleted_at is null and e.exercise_name = l.name;

-- 3b. Removed rows (block plyos, power, cutting and golf drills stay).
update public.program_exercises e
set deleted_at = now(), updated_at = now()
from v219_target_lifts s
where e.program_session_id = s.id and e.deleted_at is null
  and not exists (
    select 1 from v219_lift l where l.dow = s.day_of_week and l.name = e.exercise_name
  )
  and (e.category is distinct from 'plyo' or e.exercise_name = 'Med Ball Rotational Scoop Toss')
  and e.exercise_name not in ('Lead-Leg Posting Drill', 'Band Step-and-Rotate');

-- 3c. New rows.
insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   rir_target, seconds_target, tempo, gate_key, extra_gate_key, substitute_name, substitute_load_kind,
   substitute_reps_min, substitute_reps_max, category, counts_as_quad_set, cue, notes,
   distance_meters_target, superset_group, superset_order, left_extra_sets)
select s.user_id, s.id, l.ord, l.name, t.block_part, t.primary_muscle,
  t.readiness_requirement, t.measure, t.side_mode, t.load_kind, l.sets, l.sets,
  case l.kind when 'i' then 10 when 'c' then r.rmin else t.reps_min end,
  case l.kind when 'i' then 15 when 'c' then r.rmax else t.reps_max end,
  t.rir_target, t.seconds_target, t.tempo, t.gate_key, t.extra_gate_key, t.substitute_name, t.substitute_load_kind,
  t.substitute_reps_min, t.substitute_reps_max, t.category, t.counts_as_quad_set,
  coalesce(l.cue, t.cue), coalesce(l.notes, t.notes),
  t.distance_meters_target, l.grp, l.pos,
  case when t.side_mode = 'per_leg' then 1 else 0 end
from v219_target_lifts s
join v219_lift l on l.dow = s.day_of_week
join v219_tpl t on t.exercise_name = l.name
left join v219_reps r on r.blk = s.block_name and r.name = l.name
where not exists (
  select 1 from public.program_exercises x
  where x.program_session_id = s.id and x.deleted_at is null and x.exercise_name = l.name
)
on conflict (program_session_id, exercise_order) do nothing;

-- 3d. Power B contrast pairs: each jump right after its lift.
create function pg_temp.v219_slot(p_block text, p_day int, p_name text, p_order int, p_group text, p_pos int)
returns void language sql as $$
  update public.program_exercises e
  set exercise_order = p_order, superset_group = p_group, superset_order = p_pos, updated_at = now()
  from v219_sessions s
  where e.program_session_id = s.id and s.session_type = 'lift'
    and s.block_name = p_block and s.day_of_week = p_day
    and e.deleted_at is null and e.exercise_name = p_name
    and (e.exercise_order, e.superset_group, e.superset_order)
        is distinct from (p_order::smallint, p_group, p_pos::smallint);
$$;

select pg_temp.v219_slot('Power B', 1, 'Jump Squat', 101, 'A', 2);
select pg_temp.v219_slot('Power B', 1, 'Lateral Raise', 102, 'A', 3);
select pg_temp.v219_slot('Power B', 1, 'Broad Jump to Stick', 121, 'C', 2);
select pg_temp.v219_slot('Power B', 1, 'Single-Leg Calf Raise', 122, 'C', 3);
select pg_temp.v219_slot('Power B', 1, 'Incline Dumbbell Press', 123, 'C', 4);
select pg_temp.v219_slot('Power B', 3, 'Single-Leg Bound', 101, 'A', 2);
select pg_temp.v219_slot('Power B', 3, 'Pull-Up', 102, 'A', 3);

-- 3e. Golf drills: ungrouped, end of Wednesday.
select pg_temp.v219_slot(b, 3, 'Lead-Leg Posting Drill', 150, null, null)
from unnest(array['Block 3 Heavy + Power', 'Strength A', 'Power B', 'Strength A2']) as b;
select pg_temp.v219_slot(b, 3, 'Band Step-and-Rotate', 151, null, null)
from unnest(array['Block 3 Heavy + Power', 'Strength A', 'Power B', 'Strength A2']) as b;

-- 3f. Block 2 Friday: prep first, then the locked plyo progressions.
select pg_temp.v219_slot('Block 2 Strength', 5, 'Double-Leg Pogo', 60, null, null);
select pg_temp.v219_slot('Block 2 Strength', 5, 'Drop-Squat Landing', 61, null, null);
select pg_temp.v219_slot('Block 2 Strength', 5, 'Box Jump (12", step down)', 62, null, null);
select pg_temp.v219_slot('Block 2 Strength', 5, 'Single-Leg Hop in Place', 63, null, null);

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   rir_target, seconds_target, gate_key, extra_gate_key, category, counts_as_quad_set, cue, notes,
   left_extra_sets)
select s.user_id, s.id, p.ord, t.exercise_name, t.block_part, t.primary_muscle,
  t.readiness_requirement, t.measure, t.side_mode, t.load_kind, t.sets_min, t.sets_max, t.reps_min, t.reps_max,
  t.rir_target, t.seconds_target, t.gate_key, t.extra_gate_key, t.category, t.counts_as_quad_set, t.cue, t.notes,
  t.left_extra_sets
from v219_sessions s
cross join (values (56, 'Squat to Calf Raise'), (57, 'Snap-Down to Stick'), (58, 'Double-Leg Pogo (low)')) as p(ord, name)
join v219_tpl t on t.exercise_name = p.name
where s.session_type = 'lift' and s.block_name = 'Block 2 Strength' and s.day_of_week = 5
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null and x.exercise_name = p.name
  )
on conflict (program_session_id, exercise_order) do nothing;

-- 4. Block 2 accessories -------------------------------------------------------
update public.program_sessions s
set name = 'PT HEP (morning)', sort_order = -2, minutes_min = 8, minutes_max = 10,
    structure = 'Daily five from PT, first thing in the morning: extension check, heel slides, one-leg stand, touch step, band TKE.',
    notes = 'Spanish squat hold 4 x 30-45 s before a lift only if the kneecap hurts (optional).',
    updated_at = now()
from v219_sessions v
where s.id = v.id and v.block_name = 'Block 2 Strength' and v.name = 'PT HEP';

update public.program_exercises e
set deleted_at = now(), updated_at = now()
from v219_sessions s
where e.program_session_id = s.id and e.deleted_at is null
  and s.block_name = 'Block 2 Strength' and s.name = 'PT HEP (morning)'
  and e.exercise_name not in ('Extension Check', 'Heel Slides', 'One Leg Stand', 'Touch Step', 'Knee Extension with Band (TKE)');

update public.program_exercises e
set cue = 'Operated leg, with short-foot. 30-60 s. Eyes open, then eyes closed or on a pillow once 60 s is easy.',
    updated_at = now()
from v219_sessions s
where e.program_session_id = s.id and e.deleted_at is null
  and s.block_name = 'Block 2 Strength' and s.name = 'PT HEP (morning)'
  and e.exercise_name = 'One Leg Stand' and position('short-foot' in coalesce(e.cue, '')) = 0;

insert into public.program_sessions
  (user_id, block_id, day_of_week, sort_order, session_type, name, minutes_min, minutes_max, structure, is_optional)
select b.user_id, b.id, d.dow, n.sort_order, 'accessory', n.name, n.mmin, n.mmax, n.structure, false
from public.program_blocks b
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
cross join (values
  ('Fast drills (morning)', -1, 10, 12,
   'PT 11/5 fast drills, morning. Drop squat only on a normal knee check. Skip the forward step-down with pain beneath the kneecap.',
   array[2, 4, 6]),
  ('Scar and patellar mobs (evening)', 20, 3, 3,
   'Evening, 3 minutes. Until PT says the kneecap moves normally.',
   array[0, 1, 2, 3, 4, 5, 6])
) as n(name, sort_order, mmin, mmax, structure, days)
cross join lateral unnest(n.days) as d(dow)
where b.deleted_at is null and b.name = 'Block 2 Strength'
  and not exists (
    select 1 from public.program_sessions x
    where x.block_id = b.id and x.day_of_week = d.dow and x.deleted_at is null and x.name = n.name
  )
on conflict (block_id, day_of_week, sort_order) do nothing;

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   seconds_target, category, counts_as_quad_set, cue, notes, left_extra_sets)
select s.user_id, s.id, f.ord, t.exercise_name, t.block_part, t.primary_muscle,
  t.readiness_requirement, t.measure, t.side_mode, t.load_kind, f.sets, f.sets, f.rmin, f.rmax,
  f.secs, f.category, false,
  coalesce(f.cue, replace(replace(t.cue, ' Before the lift.', ''), 'After the main lifts. ', '')),
  null, case when t.side_mode = 'per_leg' then 1 else 0 end
from v219_sessions s
join (values
  ('Fast drills (morning)', null::int, 1, 'Double Heel Raise (Fast)', 3, 10, 10, null::int, 'plyo', null::text),
  ('Fast drills (morning)', null, 2, 'Fast Mini March', 3, 10, 10, null, 'plyo', null),
  ('Fast drills (morning)', null, 3, 'Fast High March', 3, 10, 10, null, 'plyo', null),
  ('Fast drills (morning)', null, 4, 'Band March to Wall', 3, 10, 10, null, 'plyo', null),
  ('Fast drills (morning)', null, 5, 'Drop Squat (Landing)', 3, 10, 10, null, 'plyo', null),
  ('Fast drills (morning)', null, 6, 'Forward Step-Down', 2, 10, 10, null, 'mobility', null),
  ('Fast drills (morning)', 6, 7, 'Single-Leg Calf Raise', 3, 10, 15, null, 'accessory',
     'Standing. Full stretch off the plate, 1 s pause on top. Left first.'),
  ('Scar and patellar mobs (evening)', null, 1, 'Scar and Patellar Mobs', 1, null, null, 180, 'mobility',
     'Evening. 3 minutes. Until PT says the kneecap moves normally.')
) as f(session_name, only_day, ord, name, sets, rmin, rmax, secs, category, cue)
  on f.session_name = s.name and (f.only_day is null or f.only_day = s.day_of_week)
join v219_tpl t on t.exercise_name = f.name
where s.block_name = 'Block 2 Strength'
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null and x.exercise_name = f.name
  )
on conflict (program_session_id, exercise_order) do nothing;

-- 5. Core (after ride) --------------------------------------------------------
update public.program_sessions s
set name = 'Core (after ride)', sort_order = 5, minutes_min = 10, minutes_max = 10,
    structure = 'After the ride, 10 min: dead bug, side plank, Pallof, Foundation Founder. Short-lever Copenhagen joins once adductor_ok is set.',
    notes = 'One circuit, minimal rest between moves.',
    updated_at = now()
from v219_sessions v
where s.id = v.id and v.name = 'Core (any time)'
  and v.block_name in ('Block 2 Strength', 'Block 3 Heavy + Power', 'Strength A', 'Power B', 'Strength A2');

create temp table v219_core (name text, ord int, pos int, sets int, rmin int, rmax int, secs int, cue text);
insert into v219_core values
  ('Dead Bug', 101, 1, 3, 10, 10, null, null),
  ('Side Plank', 102, 2, 2, null, null, 30,
     'Elbow under shoulder, hips stacked and high, body straight. Build from 30 to 45 s per side.'),
  ('Pallof Press', 103, 3, 2, 10, 10, null, null),
  ('Foundation Founder', 104, 4, 3, null, null, 45, null),
  ('Copenhagen Side Plank (short lever)', 105, 5, 2, null, null, 20, null);

create temp view v219_core_sessions as
select * from v219_sessions where name = 'Core (after ride)'
  and block_name in ('Block 2 Strength', 'Block 3 Heavy + Power', 'Strength A', 'Power B', 'Strength A2');

update public.program_exercises e
set exercise_order = c.ord, superset_group = 'A', superset_order = c.pos,
    sets_min = c.sets, sets_max = c.sets,
    reps_min = coalesce(c.rmin, e.reps_min), reps_max = coalesce(c.rmax, e.reps_max),
    seconds_target = coalesce(c.secs, e.seconds_target),
    cue = coalesce(c.cue, e.cue), from_week = null, until_week = null, updated_at = now()
from v219_core_sessions s
join v219_core c on true
where e.program_session_id = s.id and e.deleted_at is null and e.exercise_name = c.name;

update public.program_exercises e
set deleted_at = now(), updated_at = now()
from v219_core_sessions s
where e.program_session_id = s.id and e.deleted_at is null
  and e.exercise_name not in (select name from v219_core);

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   seconds_target, gate_key, category, counts_as_quad_set, cue, notes,
   superset_group, superset_order, left_extra_sets)
select s.user_id, s.id, c.ord, c.name, t.block_part, t.primary_muscle,
  t.readiness_requirement, t.measure, t.side_mode, t.load_kind, c.sets, c.sets, c.rmin, c.rmax,
  c.secs, t.gate_key, t.category, false, coalesce(c.cue, t.cue), t.notes,
  'A', c.pos, 0
from v219_core_sessions s
join v219_core c on true
join v219_tpl t on t.exercise_name = c.name
where not exists (
  select 1 from public.program_exercises x
  where x.program_session_id = s.id and x.deleted_at is null and x.exercise_name = c.name
)
on conflict (program_session_id, exercise_order) do nothing;

-- 6. Rides ---------------------------------------------------------------------
update public.program_sessions s
set minutes_min = 45, minutes_max = 45, updated_at = now()
from v219_sessions v
where s.id = v.id and v.block_name = 'Block 2 Strength' and v.session_type = 'peloton'
  and v.day_of_week = 4 and (s.minutes_min, s.minutes_max) is distinct from (45::smallint, 45::smallint);

update public.program_sessions s
set name = 'Peloton long ride', ride_kind = 'threshold_intervals', gate_key = 'bike_resistance_ceiling',
    minutes_min = 60, minutes_max = 60,
    structure = '10 min easy, then 2 x 15 min hard and steady (seated, high resistance, 5 min easy between), Zone 2 to finish. Until bike_resistance_ceiling is set it runs as seated Zone 2 (125 to 132 bpm, cap 135, cadence 85 to 90).',
    updated_at = now()
from v219_sessions v
where s.id = v.id and v.name = 'Peloton Zone 2 (long)' and v.day_of_week = 6
  and v.block_name in ('Block 2 Strength', 'Block 3 Heavy + Power', 'Strength A', 'Power B', 'Strength A2');

-- 7. Week 13: its own copy of the v2.19 week --------------------------------------
insert into public.program_sessions
  (user_id, block_id, day_of_week, sort_order, session_type, name, upper_template_id, ride_kind,
   minutes_min, minutes_max, structure, gate_key, notes, is_optional)
select s.user_id, d.id, s.day_of_week, s.sort_order, s.session_type,
  case when s.session_type = 'lift' and s.day_of_week = 5 then 'Quad + Arms' else s.name end,
  s.upper_template_id, s.ride_kind, s.minutes_min, s.minutes_max, s.structure, s.gate_key, s.notes, s.is_optional
from public.program_sessions s
join public.program_blocks b2 on b2.id = s.block_id and b2.deleted_at is null and b2.name = 'Block 2 Strength'
join public.training_programs p on p.id = b2.program_id and p.is_active and p.deleted_at is null
join public.program_blocks d on d.program_id = b2.program_id and d.deleted_at is null and d.name = 'Deload + Test'
where s.deleted_at is null
  and not exists (select 1 from public.program_sessions x where x.block_id = d.id and x.deleted_at is null)
on conflict (block_id, day_of_week, sort_order) do nothing;

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, from_week, until_week,
   primary_muscle, readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max,
   reps_min, reps_max, rir_target, seconds_target, tempo, gate_key, substitute_name, substitute_load_kind,
   notes, category, counts_as_quad_set, cue, extra_gate_key, distance_meters_target,
   substitute_reps_min, substitute_reps_max, superset_group, superset_order, left_extra_sets)
select t.user_id, t.id, e.exercise_order, e.exercise_name, e.block_part, null, null,
  e.primary_muscle, e.readiness_requirement, e.measure, e.side_mode, e.load_kind, e.sets_min, e.sets_max,
  coalesce(r.rmin, e.reps_min), coalesce(r.rmax, e.reps_max), e.rir_target, e.seconds_target, e.tempo,
  e.gate_key, e.substitute_name, e.substitute_load_kind,
  e.notes, e.category, e.counts_as_quad_set, e.cue, e.extra_gate_key, e.distance_meters_target,
  e.substitute_reps_min, e.substitute_reps_max, e.superset_group, e.superset_order, e.left_extra_sets
from v219_sessions t
join v219_sessions src on src.block_name = 'Block 2 Strength' and src.program_id = t.program_id
  and src.day_of_week = t.day_of_week and src.sort_order = t.sort_order
join public.program_exercises e on e.program_session_id = src.id and e.deleted_at is null
left join v219_reps r on r.blk = 'Deload + Test' and r.name = e.exercise_name and src.session_type = 'lift'
where t.block_name = 'Deload + Test'
  and e.exercise_name not in ('Double-Leg Pogo', 'Drop-Squat Landing', 'Box Jump (12", step down)', 'Single-Leg Hop in Place')
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = t.id and x.deleted_at is null
  )
on conflict (program_session_id, exercise_order) do nothing;

-- 8. Return to Sport + Maintenance -------------------------------------------------
create temp view v219_rts as
select * from v219_sessions where block_name = 'Return to Sport + Maintenance';

update public.program_exercises e
set deleted_at = now(), updated_at = now()
from v219_rts s
where e.program_session_id = s.id and e.deleted_at is null
  and e.exercise_name in ('Petersen Step-Up (4–6")', 'Med Ball Rotational Scoop Toss', 'Tricep Pushdown');

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, reps_min, reps_max,
   category, counts_as_quad_set, cue, superset_group, superset_order, left_extra_sets)
select s.user_id, s.id, 60, t.exercise_name, t.block_part, t.primary_muscle,
  t.readiness_requirement, t.measure, t.side_mode, t.load_kind, 4, 4, 10, 15,
  t.category, false, t.cue, 'C', 3, 0
from v219_rts s
join v219_tpl t on t.exercise_name = 'Overhead Cable Triceps Extension'
where s.session_type = 'lift' and s.day_of_week = 4
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null and x.exercise_name = t.exercise_name
  )
on conflict (program_session_id, exercise_order) do nothing;

update public.program_exercises e
set reps_min = 10, reps_max = 15, updated_at = now()
from v219_rts s
where e.program_session_id = s.id and e.deleted_at is null and s.session_type = 'lift'
  and e.exercise_name in ('Lateral Raise', 'Single-Leg Calf Raise', 'Tricep Extension', 'Hammer Curl', 'Face Pull', 'Dumbbell Curl')
  and (e.reps_min, e.reps_max) is distinct from (10::smallint, 15::smallint);

update public.program_exercises e
set gate_key = 'kneel_pain_free', updated_at = now()
from v219_rts s
where e.program_session_id = s.id and e.deleted_at is null
  and e.exercise_name = 'Nordic Curl (eccentric, band-assisted)' and e.gate_key is null;

-- 9. Version -------------------------------------------------------------------------
update public.training_programs
set version = 'program v2.19, 2026-11-13', updated_at = now()
where is_active and deleted_at is null and version is distinct from 'program v2.19, 2026-11-13';

drop function pg_temp.v219_slot(text, int, text, int, text, int);
drop view v219_rts;
drop view v219_core_sessions;
drop table v219_core;
drop view v219_target_lifts;
drop table v219_reps;
drop table v219_lift;
drop table v219_tpl;
drop view v219_sessions;
