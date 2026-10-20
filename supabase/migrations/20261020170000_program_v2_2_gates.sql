-- Program v2.2 safety gates (backlog B-01 + B-19), owner approved 2026-10-20:
-- "gate everything that needs clinician sign-off". Week 10 starts Mon 2026-10-26.
--
-- What and why:
-- 1. New gate `intervals` ("Bike intervals (climb, threshold, VO2)", earliest 2026-10-26,
--    the surgeon visit week). Plan section 5 parks VO2/interval work until the
--    surgeon visit, pain 2/10 or less and no swelling; section 1 allows no
--    standing climbs until strength is 5/5 or PT clears it.
-- 2. Every interval ride gets that gate: Thursday climb intervals (Block 1),
--    4 x 4 (Block 2), VO2 max (Block 3, Strength A, Power B, Strength A2) and
--    the return-to-sport Tuesday VO2 ride (7 sessions). While the gate is
--    closed the engine runs the ride as seated Zone 2 for the same minutes
--    (program-plan.ts); clearing the gate in Settings restores the intervals.
-- 3. Landing prep (Squat to Calf Raise, Snap-Down to Stick, Double-Leg Pogo
--    (low)) moves behind `plyo_double`, like every later jump: the 10/16 PT
--    note says "still unable: jumping". The squat to calf raise has no flight
--    but is the jump take-off drilled at speed and only leads into the pogo;
--    squats to 90 degrees and calf raises already run ungated, so it is gated
--    with the rest. Rows: On-ramp (never shown, from week 10) and Block 1 Friday.
-- 4. Block 2 Friday plyos lose their fallbacks (the landing prep, now behind
--    the same gate, and a low pogo, which is a jump): a closed `plyo_double`
--    greys them out instead.
-- 5. Week 10 note, program version "program v2.2, 2026-10-20", the three lift templates
--    rebuilt (version line; Friday drops the gated landing prep).
-- 6. B-19: the program rules said "Lift days: 55-60 min"; v2.1 targets about
--    an hour (43-63 min). Only that line of the stored rules text changes, so
--    other edits made in Settings are kept.
--
-- Rows are what supabase/generators/program_v2.py (v2.2) emits, updated in
-- place and matched the way the seed matches (block name, weekday + slot,
-- exercise slot, plus the expected exercise name). Idempotent and safe to
-- rerun; no deletes; logged history is not touched. Gate cleared dates and
-- notes are kept. Needs 20261020150000_seed_program_v2_1.sql first. The
-- Kazaglis week notes are unchanged.

-- 1. Gate: a cleared date and notes are kept; the earliest date only fills a blank.
with o as (select user_id as uid from public.profiles order by created_at limit 1)
insert into public.program_gates (user_id, gate_key, label, earliest_on, cleared_on, notes)
select o.uid, g.gate_key, g.label, coalesce(old.earliest_on, g.earliest_on), old.cleared_on, old.notes
from o
cross join (values
  ('intervals', 'Bike intervals (climb, threshold, VO2)', '2026-10-26'::date)
) as g(gate_key, label, earliest_on)
left join public.program_gates old
  on old.user_id = o.uid and old.gate_key = g.gate_key
on conflict (user_id, gate_key) do update
  set label = excluded.label,
      earliest_on = coalesce(public.program_gates.earliest_on, excluded.earliest_on),
      deleted_at = null;

-- 2. Program version.
with o as (select user_id as uid from public.profiles order by created_at limit 1)
update public.training_programs p
set version = 'program v2.2, 2026-10-20'
from o
where p.user_id = o.uid and p.name = 'ACL return';

-- 3. Interval rides wait on the intervals gate.
with o as (select user_id as uid from public.profiles order by created_at limit 1)
update public.program_sessions s
set gate_key = 'intervals'
from o join public.training_programs p on p.user_id = o.uid and p.name = 'ACL return'
join public.program_blocks b on b.program_id = p.id and b.deleted_at is null
join (values
  ('Block 1 Build', 4, 1, 'Peloton climb intervals'),
  ('Block 2 Strength', 4, 1, 'Peloton 4 x 4'),
  ('Block 3 Heavy + Power', 4, 1, 'Peloton VO2 max'),
  ('Strength A', 4, 1, 'Peloton VO2 max'),
  ('Power B', 4, 1, 'Peloton VO2 max'),
  ('Strength A2', 4, 1, 'Peloton VO2 max'),
  ('Return to Sport + Maintenance', 2, 1, 'Peloton VO2 max')
) as v(block_name, d, so, n) on v.block_name = b.name
where s.block_id = b.id and s.day_of_week = v.d and s.sort_order = v.so
  and s.name = v.n and s.session_type = 'peloton' and s.deleted_at is null;

-- 4. Landing prep behind plyo_double.
with o as (select user_id as uid from public.profiles order by created_at limit 1)
update public.program_exercises e
set gate_key = 'plyo_double', notes = 'Landing prep: waits on the plyo_double gate (PT sign-off), then normal knee check only. Land quiet, knees over toes, hold 2 s.'
from o join public.training_programs p on p.user_id = o.uid and p.name = 'ACL return'
join public.program_blocks b on b.program_id = p.id and b.deleted_at is null
join public.program_sessions s on s.block_id = b.id and s.day_of_week = 5 and s.sort_order = 0
  and s.deleted_at is null
join (values
  ('On-ramp', 0, 'Squat to Calf Raise'),
  ('On-ramp', 1, 'Snap-Down to Stick'),
  ('On-ramp', 2, 'Double-Leg Pogo (low)'),
  ('Block 1 Build', 0, 'Squat to Calf Raise'),
  ('Block 1 Build', 1, 'Snap-Down to Stick'),
  ('Block 1 Build', 2, 'Double-Leg Pogo (low)')
) as v(block_name, o, n) on v.block_name = b.name
where e.program_session_id = s.id and e.exercise_order = v.o and e.exercise_name = v.n
  and e.deleted_at is null;

-- 5. Block 2 Friday plyos: no fallbacks (they were the landing prep and a low pogo).
with o as (select user_id as uid from public.profiles order by created_at limit 1)
update public.program_exercises e
set substitute_name = null, substitute_load_kind = null,
    substitute_reps_min = null, substitute_reps_max = null, notes = v.nt
from o join public.training_programs p on p.user_id = o.uid and p.name = 'ACL return'
join public.program_blocks b on b.program_id = p.id and b.name = 'Block 2 Strength' and b.deleted_at is null
join public.program_sessions s on s.block_id = b.id and s.day_of_week = 5 and s.sort_order = 0
  and s.deleted_at is null
join (values
  (0, 'Double-Leg Pogo', 'Normal knee check only. Quality only: end the set if landings get loud or the knee caves.'),
  (1, 'Drop-Squat Landing', 'Normal knee check only. Quality only: end the set if landings get loud or the knee caves.'),
  (2, 'Box Jump (12", step down)', 'Normal knee check only. Quality only: end the set if landings get loud or the knee caves.')
) as v(o, n, nt) on true
where e.program_session_id = s.id and e.exercise_order = v.o and e.exercise_name = v.n
  and e.gate_key = 'plyo_double' and e.deleted_at is null;

-- 6. Week 10 note.
with o as (select user_id as uid from public.profiles order by created_at limit 1)
update public.program_weeks w
set notes = 'Block 1. Landing prep waits on the two-leg plyo gate; Thursday rides Zone 2 until bike intervals are cleared (Settings).'
from o join public.training_programs p on p.user_id = o.uid and p.name = 'ACL return'
where w.program_id = p.id and w.week_number = 10 and w.deleted_at is null;

-- 7. B-19: lift-day length in the stored program rules.
with o as (select user_id as uid from public.profiles order by created_at limit 1)
update public.training_settings t
set text_value = replace(t.text_value, 'Lift days: 55-60 min,', 'Lift days: about an hour (43-63 min),')
from o
where t.user_id = o.uid and t.key = 'program_rules' and t.deleted_at is null
  and t.text_value like '%Lift days: 55-60 min,%';

-- 8. Lift templates (the fallback lists when the program card is not showing).
-- Monday and Wednesday: only the version at the start of the notes changes.
with o as (select user_id as uid from public.profiles order by created_at limit 1)
update public.training_templates t
set definition = jsonb_set(t.definition, '{notes}',
      to_jsonb(replace(t.definition ->> 'notes', 'program v2.1, 2026-10-19', 'program v2.2, 2026-10-20')))
from o
where t.user_id = o.uid and t.template_type = 'strength' and t.deleted_at is null
  and t.scheduled_day_of_week in (1, 3) and t.definition ->> 'notes' like 'program v2.1, 2026-10-19,%';

-- Friday: rebuilt (the gated landing prep has no fallback, so it is left out).
with o as (select user_id as uid from public.profiles order by created_at limit 1)
update public.training_templates t
set name = 'Fri Quad + Arms', definition = '{"notes": "program v2.2, 2026-10-20, Block 1 (weeks 10-12). The program card on /strength is the source of truth (knee check, gates, loads); use this list when that card is not showing. Warm-up 5 min: Peloton easy 3 min; band TKE 15/leg; bodyweight box squat x10; glute bridge x10. Gait drill 3 min: Slow march, then step-throughs to a metronome at preferred cadence +5%. Pairs: alternate A1 and A2, rest after the pair. Left leg first on per-leg work. No kneeling on the left knee; on and off benches leading with the right leg.", "exercises": [{"exerciseName": "Spanish Squat", "exerciseOrder": 1, "targetSets": 3, "targetReps": null, "targetWeight": null, "targetRir": null, "notes": "A1. 45 s. Heavy band, no deeper than 60°. Band behind the knees, shins vertical, no deeper than 60°."}, {"exerciseName": "Chin-Up", "exerciseOrder": 2, "targetSets": 3, "targetReps": 5, "targetWeight": null, "targetRir": 1, "notes": "A2. 3-5 reps. 1 rep short of failure. Reach the bar from the bench; step down with the right leg. No jumping or dropping."}, {"exerciseName": "Isometric Knee Extension (90°)", "exerciseOrder": 3, "targetSets": 5, "targetReps": null, "targetWeight": null, "targetRir": null, "notes": "5 s max, log peak N, per leg. Strapped, crane scale; log peak N. Alternate L/R. Left first. 5-s ramp, don''t jerk; strap level and perpendicular to the shin."}, {"exerciseName": "Heel-Elevated Goblet Squat (to 90°)", "exerciseOrder": 4, "targetSets": 3, "targetReps": 12, "targetWeight": null, "targetRir": 2, "notes": "C1. Heels up, torso tall, knees forward over the toes."}, {"exerciseName": "Close-Grip Bench Press", "exerciseOrder": 5, "targetSets": 3, "targetReps": 10, "targetWeight": null, "targetRir": 2, "notes": "C2. 8-10 reps. Feet flat; elbows tucked."}, {"exerciseName": "DB Single-Leg RDL", "exerciseOrder": 6, "targetSets": 3, "targetReps": 10, "targetWeight": null, "targetRir": 2, "notes": "D1. Per leg. Left first. Hinge at the hip, hips square, soft knee."}, {"exerciseName": "Dumbbell Shoulder Press", "exerciseOrder": 7, "targetSets": 3, "targetReps": 12, "targetWeight": null, "targetRir": 2, "notes": "D2. 10-12 reps. Seated. Ribs down, press straight up."}, {"exerciseName": "Tricep Extension", "exerciseOrder": 8, "targetSets": 2, "targetReps": 15, "targetWeight": null, "targetRir": 2, "notes": "D3. 12-15 reps. Overhead DB. Elbows in, full stretch."}]}'::jsonb
from o
where t.user_id = o.uid and t.template_type = 'strength' and t.deleted_at is null
  and t.scheduled_day_of_week = 5;

-- 9. Checks: a mismatch fails the cast (the error names it) and rolls back.
with p as (
  select p.id from public.training_programs p
  join public.profiles pr on pr.user_id = p.user_id
  where p.name = 'ACL return' order by pr.created_at limit 1
), c as (
  select
    (select count(*) from public.program_sessions s join public.program_blocks b on b.id = s.block_id, p
      where b.program_id = p.id and s.deleted_at is null and b.deleted_at is null
        and s.session_type = 'peloton' and s.ride_kind <> 'zone2' and s.gate_key = 'intervals') as rides,
    (select count(*) from public.program_sessions s join public.program_blocks b on b.id = s.block_id, p
      where b.program_id = p.id and s.deleted_at is null and b.deleted_at is null
        and s.session_type = 'peloton' and s.ride_kind <> 'zone2' and s.gate_key is distinct from 'intervals') as ungated,
    (select count(*) from public.program_exercises e join public.program_sessions s on s.id = e.program_session_id
      join public.program_blocks b on b.id = s.block_id, p
      where b.program_id = p.id and e.deleted_at is null and s.deleted_at is null and b.deleted_at is null
        and e.category = 'plyo' and e.gate_key is null and e.readiness_requirement = 'normal'
        and b.name in ('On-ramp', 'Block 1 Build', 'Block 2 Strength')) as open_plyo,
    (select count(*) from public.program_gates g join public.training_programs tp on tp.user_id = g.user_id, p
      where tp.id = p.id and g.gate_key = 'intervals' and g.deleted_at is null) as gates
)
select ('v2.2 gates check failed: gated rides ' || rides || '/7, ungated interval rides '
  || ungated || '/0, ungated plyo through Block 2 ' || open_plyo || '/0, intervals gate ' || gates || '/1')::int
from c
where rides <> 7 or ungated <> 0 or open_plyo <> 0 or gates <> 1;
