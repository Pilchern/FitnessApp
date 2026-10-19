-- Seeds the post-op lower-body program for the app's single owner.
--
-- Idempotent: every insert is keyed on a natural unique key and does nothing
-- when the row exists, so a rerun adds only what is missing and never
-- overwrites edits made in the app. No-op on a database without a profile.
-- Upper-body days point at the owner's existing Mon/Wed/Fri strength
-- templates (looked up by weekday); no loads are written anywhere.
do $$
declare
  uid uuid;
  pid uuid;
  b_onramp uuid;
  b1 uuid;
  b_deload1 uuid;
  b2 uuid;
  b_deload2 uuid;
  b3 uuid;
  t_mon uuid;
  t_wed uuid;
  t_fri uuid;
begin
  select user_id into uid from public.profiles order by created_at limit 1;
  if uid is null then
    return;
  end if;

  -- Program -----------------------------------------------------------------
  insert into public.training_programs
    (user_id, name, week_anchor_date, return_to_sport_week, test_day_url, notes)
  values (
    uid,
    'ACL return',
    date '2026-08-17',
    39,
    'https://nick-pt-tracker.vercel.app',
    'Left ACL reconstruction (BTB). Weeks count from the surgery date. Strength tests, gait and return-to-sport gates live in the PT Tracker.'
  )
  on conflict (user_id, name) do nothing;

  select id into pid from public.training_programs
  where user_id = uid and name = 'ACL return';

  -- Gates (manual toggles in Settings) --------------------------------------
  insert into public.program_gates (user_id, gate_key, label)
  values
    (uid, 'barbell_squat', 'Barbell squat'),
    (uid, 'depth_past_90', 'Squat depth past 90°'),
    (uid, 'full_range_knee_extension', 'Full-range knee extension'),
    (uid, 'nordic', 'Nordic curl'),
    (uid, 'jog', 'Jog (walk-jog)'),
    (uid, 'plyo', 'Plyometrics (jumping)'),
    (uid, 'single_leg_hops', 'Single-leg hops')
  on conflict (user_id, gate_key) do nothing;

  -- Blocks --------------------------------------------------------------------
  insert into public.program_blocks
    (user_id, program_id, name, start_week, end_week,
     sets_min, sets_max, reps_min, reps_max, rir_target, rep_scheme, notes)
  values
    (uid, pid, 'On-ramp', 9, 9, 2, 3, 12, 12, 3,
     '2–3 x 12 @ RIR 3–4', 'First loaded leg week. Learn the movements; leave reps in the tank.'),
    (uid, pid, 'Block 1 Build', 10, 12, 3, 4, 10, 12, 2,
     '3–4 x 10–12 @ RIR 2', null),
    (uid, pid, 'Deload/Test', 13, 13, null, null, null, null, null,
     'Block 1 minus 1 set, no load increase', 'Retest in the PT Tracker this week.'),
    (uid, pid, 'Block 2 Strength', 14, 17, 4, 4, 6, 8, 2,
     '4 x 6–8 @ RIR 2', null),
    (uid, pid, 'Deload', 18, 18, null, null, null, null, null,
     'Block 2 minus 1 set, no load increase', null),
    (uid, pid, 'Block 3 Heavy + Power', 19, 22, 4, 5, 3, 5, 2,
     '4–5 x 3–5 @ RIR 2', null),
    (uid, pid, 'Block 4 Sport Prep', 23, 38, null, null, null, null, null,
     'To be written', 'Placeholder. Add its sessions as rows (see README).')
  on conflict (program_id, name) do nothing;

  select id into b_onramp from public.program_blocks where program_id = pid and name = 'On-ramp';
  select id into b1 from public.program_blocks where program_id = pid and name = 'Block 1 Build';
  select id into b_deload1 from public.program_blocks where program_id = pid and name = 'Deload/Test';
  select id into b2 from public.program_blocks where program_id = pid and name = 'Block 2 Strength';
  select id into b_deload2 from public.program_blocks where program_id = pid and name = 'Deload';
  select id into b3 from public.program_blocks where program_id = pid and name = 'Block 3 Heavy + Power';

  -- Deloads run the block before them (minus a set, no increases).
  update public.program_blocks set sessions_from_block_id = b1
  where id = b_deload1 and sessions_from_block_id is null;
  update public.program_blocks set sessions_from_block_id = b2
  where id = b_deload2 and sessions_from_block_id is null;

  -- Weeks 9-38; deload flags on 13 and 18 ------------------------------------
  insert into public.program_weeks (user_id, program_id, week_number, is_deload)
  select uid, pid, w, w in (13, 18)
  from generate_series(9, 38) as w
  on conflict (program_id, week_number) do nothing;

  -- Existing upper-body templates by weekday ---------------------------------
  select id into t_mon from public.training_templates
  where user_id = uid and template_type = 'strength' and scheduled_day_of_week = 1
    and not is_archived and deleted_at is null
  order by created_at limit 1;
  select id into t_wed from public.training_templates
  where user_id = uid and template_type = 'strength' and scheduled_day_of_week = 3
    and not is_archived and deleted_at is null
  order by created_at limit 1;
  select id into t_fri from public.training_templates
  where user_id = uid and template_type = 'strength' and scheduled_day_of_week = 5
    and not is_archived and deleted_at is null
  order by created_at limit 1;

  -- Sessions: the same week shape in On-ramp and Blocks 1-3 -------------------
  insert into public.program_sessions
    (user_id, block_id, day_of_week, sort_order, session_type, name,
     upper_template_id, ride_kind, minutes_min, minutes_max, structure, gate_key, notes)
  select uid, b.id, s.day, s.sort, s.kind, s.name,
    case s.day when 1 then t_mon when 3 then t_wed when 5 then t_fri end,
    s.ride, s.min_m, s.max_m, s.structure, s.gate, s.notes
  from (values (b_onramp, 0), (b1, 1), (b2, 2), (b3, 3)) as b(id, n)
  cross join (values
    (1::smallint, 0::smallint, 'lift', 'Heavy legs + Push', null::text, null::smallint, null::smallint, null::text, null::text, 'Legs first, then the Push template.'),
    (3::smallint, 0::smallint, 'lift', 'Single-leg + Pull', null, null, null, null, null, 'PT this morning. Legs first, then the Pull template.'),
    (5::smallint, 0::smallint, 'lift', 'Quad isolation + Arms', null, null, null, null, null, 'PT this morning. Legs first, then the Arms template.'),
    (2::smallint, 1::smallint, 'peloton', 'Peloton Zone 2', 'zone2', 30::smallint, 45::smallint, null, null, null),
    (6::smallint, 1::smallint, 'peloton', 'Peloton Zone 2 (long)', 'zone2', 45::smallint, 60::smallint, null, null, null),
    (0::smallint, 0::smallint, 'test', 'Test day + walk', null, null, null,
     'Strength and gait tests in the PT Tracker, then an easy walk.', null, null)
  ) as s(day, sort, kind, name, ride, min_m, max_m, structure, gate, notes)
  on conflict (block_id, day_of_week, sort_order) do nothing;

  -- Thursday: Zone 2 in the On-ramp, seated climb intervals from week 10.
  insert into public.program_sessions
    (user_id, block_id, day_of_week, sort_order, session_type, name,
     ride_kind, minutes_min, minutes_max, structure)
  values
    (uid, b_onramp, 4, 1, 'peloton', 'Peloton Zone 2', 'zone2', 30, 45, null),
    (uid, b1, 4, 1, 'peloton', 'Peloton climb intervals', 'climb_intervals', 45, 45,
     '10 min warm-up; 5 x 3 min seated, cadence 60–70, RPE 7, 3 min easy between; 5 min cool-down.'),
    (uid, b2, 4, 1, 'peloton', 'Peloton climb intervals', 'climb_intervals', 45, 45,
     '10 min warm-up; 5 x 3 min seated, cadence 60–70, RPE 7, 3 min easy between; 5 min cool-down.'),
    (uid, b3, 4, 1, 'peloton', 'Peloton climb intervals', 'climb_intervals', 45, 45,
     '10 min warm-up; 5 x 3 min seated, cadence 60–70, RPE 7, 3 min easy between; 5 min cool-down.')
  on conflict (block_id, day_of_week, sort_order) do nothing;

  -- Walk-jog (hidden until the jog gate is cleared): Tue/Sat before the ride.
  insert into public.program_sessions
    (user_id, block_id, day_of_week, sort_order, session_type, name,
     minutes_min, minutes_max, structure, gate_key, notes)
  select uid, b.id, d.day, 0, 'walk_jog', 'Walk-jog', 12, 20,
    'Start at 1 min jog / 1 min walk x 6.', 'jog',
    'Ride after it is cut to 15–20 min.'
  from (values (b1), (b2), (b3)) as b(id)
  cross join (values (2::smallint), (6::smallint)) as d(day)
  on conflict (block_id, day_of_week, sort_order) do nothing;

  -- Exercises for On-ramp and Block 1 ----------------------------------------
  -- Null sets/reps/RIR use the block's scheme. Columns:
  -- day, order, name, muscle, readiness, measure, side, load,
  -- sets_min, sets_max, reps_min, reps_max, rir, seconds, tempo,
  -- gate, substitute, substitute_load, notes, from_week_10
  insert into public.program_exercises
    (user_id, program_session_id, exercise_order, exercise_name, primary_muscle,
     readiness_requirement, measure, side_mode, load_kind,
     sets_min, sets_max, reps_min, reps_max, rir_target, seconds_target, tempo,
     gate_key, substitute_name, substitute_load_kind, notes)
  select uid, ps.id, e.ord, e.name, e.muscle, e.readiness, e.measure, e.side, e.load,
    e.sets_min, e.sets_max, e.reps_min, e.reps_max, e.rir, e.secs, e.tempo,
    e.gate, e.sub, e.sub_load, e.notes
  from public.program_sessions ps
  join (values
    -- Monday: heavy legs
    (1::smallint, 0::smallint, 'Barbell Pin Squat (to 90°)', 'quads', 'any', 'reps', 'bilateral', 'barbell',
      null::smallint, null::smallint, null::smallint, null::smallint, null::numeric, null::smallint, null::text,
      'barbell_squat', 'Goblet Box Squat (to 90°)', 'dumbbell', 'Pins set at 90°. Goblet box squat until the barbell gate is cleared.', false),
    (1::smallint, 1::smallint, 'Cuff Knee Extension (90→45°)', 'quads', 'any', 'reps', 'per_leg', 'cuff',
      null, null, null, null, null, null, null,
      null, null, null, 'Left first. Plate or DB hangs from the ankle cuff. Stop at 45°.', false),
    (1::smallint, 2::smallint, 'Barbell Hip Thrust', 'glutes', 'any', 'reps', 'bilateral', 'barbell',
      null, null, null, null, null, null, null, null, null, null, null, false),
    (1::smallint, 3::smallint, 'Single-Leg Calf Raise', 'calves', 'any', 'reps', 'per_leg', 'dumbbell',
      null, null, null, null, null, null, null, null, null, null, 'Left first.', false),
    -- Wednesday: single-leg
    (3::smallint, 0::smallint, 'DB Step-Up (12")', 'quads', 'any', 'reps', 'per_leg', 'dumbbell',
      null, null, null, null, null, null, '3-sec lowering', null, null, null, 'Left first.', false),
    (3::smallint, 1::smallint, 'Split Squat (to 90°)', 'quads', 'any', 'reps', 'per_leg', 'dumbbell',
      null, null, null, null, null, null, null, null, null, null, 'Left first.', false),
    (3::smallint, 2::smallint, 'Slider Hamstring Curl', 'hamstrings', 'any', 'reps', 'bilateral', 'bodyweight',
      null, null, null, null, null, null, null, null, null, null, null, false),
    (3::smallint, 3::smallint, 'Copenhagen Plank (short lever)', 'adductors', 'any', 'time', 'per_leg', 'bodyweight',
      3::smallint, 3::smallint, null, null, null, 20::smallint, null, null, null, null, 'Seconds per side.', false),
    (3::smallint, 4::smallint, 'Single-Leg Balance (perturbation)', null, 'any', 'time', 'per_leg', 'bodyweight',
      3::smallint, 3::smallint, null, null, null, 30::smallint, null, null, null, null, 'Seconds per side.', false),
    (3::smallint, 5::smallint, 'Gait Drill', null, 'any', 'time', 'bilateral', 'bodyweight',
      1::smallint, 1::smallint, null, null, null, 300::smallint, null, null, null, null, '5 min.', false),
    -- Friday: quad isolation
    (5::smallint, 0::smallint, 'Spanish Squat', 'quads', 'any', 'time', 'bilateral', 'band',
      3::smallint, 3::smallint, null, null, null, 45::smallint, null, null, null, null, null, false),
    (5::smallint, 1::smallint, 'Isometric Knee Extension (90°)', 'quads', 'any', 'force', 'per_leg', 'bodyweight',
      5::smallint, 5::smallint, null, null, null, 5::smallint, null, null, null, null,
      'Strapped, 5 s max effort. Log peak newtons from the crane scale. Left first.', false),
    (5::smallint, 2::smallint, 'Heel-Elevated Goblet Squat (to 90°)', 'quads', 'any', 'reps', 'bilateral', 'dumbbell',
      null, null, null, null, null, null, '3-1-1', null, null, null, null, false),
    (5::smallint, 3::smallint, 'DB Single-Leg RDL', 'hamstrings', 'any', 'reps', 'per_leg', 'dumbbell',
      null, null, null, null, null, null, null, null, null, null, 'Left first.', false),
    (5::smallint, 4::smallint, 'Bent-Knee Calf Raise', 'calves', 'any', 'reps', 'bilateral', 'dumbbell',
      null, null, null, null, null, null, null, null, null, null, null, false),
    -- Friday landing prep, from week 10, normal knee check only
    (5::smallint, 5::smallint, 'Squat to Calf Raise', null, 'normal', 'reps', 'bilateral', 'bodyweight',
      2::smallint, 2::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, 'Landing prep.', true),
    (5::smallint, 6::smallint, 'Snap-Down to Stick', null, 'normal', 'reps', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 5::smallint, 5::smallint, null, null, null, null, null, null, 'Landing prep. No flight phase.', true),
    (5::smallint, 7::smallint, 'Double-Leg Pogo', null, 'normal', 'reps', 'bilateral', 'bodyweight',
      2::smallint, 2::smallint, 10::smallint, 10::smallint, null, null, null, 'plyo', null, null,
      'Landing prep. Has a flight phase, so it waits for the plyo gate (PT sign-off).', true)
  ) as e(day, ord, name, muscle, readiness, measure, side, load,
         sets_min, sets_max, reps_min, reps_max, rir, secs, tempo,
         gate, sub, sub_load, notes, from_week_10)
    on ps.day_of_week = e.day and ps.sort_order = 0 and ps.session_type = 'lift'
  where ps.user_id = uid
    and (ps.block_id = b1 or (ps.block_id = b_onramp and not e.from_week_10))
  on conflict (program_session_id, exercise_order) do nothing;

  -- Blocks 2-3: same exercise slots (main lifts take the block scheme) -------
  insert into public.program_exercises
    (user_id, program_session_id, exercise_order, exercise_name, primary_muscle,
     readiness_requirement, measure, side_mode, load_kind,
     sets_min, sets_max, reps_min, reps_max, rir_target, seconds_target, tempo,
     gate_key, substitute_name, substitute_load_kind, notes)
  select uid, target.id, src.exercise_order, src.exercise_name, src.primary_muscle,
    src.readiness_requirement, src.measure, src.side_mode, src.load_kind,
    src.sets_min, src.sets_max, src.reps_min, src.reps_max, src.rir_target,
    src.seconds_target, src.tempo, src.gate_key, src.substitute_name,
    src.substitute_load_kind, src.notes
  from public.program_sessions source_session
  join public.program_exercises src
    on src.program_session_id = source_session.id and src.deleted_at is null
  join public.program_sessions target
    on target.day_of_week = source_session.day_of_week
   and target.sort_order = source_session.sort_order
   and target.session_type = 'lift'
   and target.block_id in (b2, b3)
  where source_session.block_id = b1
    and source_session.session_type = 'lift'
  on conflict (program_session_id, exercise_order) do nothing;

  -- Gated slots for Blocks 2-3 (hidden or greyed until cleared) --------------
  insert into public.program_exercises
    (user_id, program_session_id, exercise_order, exercise_name, primary_muscle,
     readiness_requirement, measure, side_mode, load_kind,
     sets_min, sets_max, reps_min, reps_max, gate_key, notes)
  select uid, ps.id, g.ord, g.name, g.muscle, g.readiness, 'reps', g.side, g.load,
    g.sets_min, g.sets_max, g.reps_min, g.reps_max, g.gate, g.notes
  from public.program_sessions ps
  join (values
    (b2, 1::smallint, 10::smallint, 'Front Squat (full depth)', 'quads', 'any', 'bilateral', 'barbell',
      null::smallint, null::smallint, null::smallint, null::smallint, 'depth_past_90', null::text),
    (b2, 3::smallint, 10::smallint, 'Nordic Curl (eccentric)', 'hamstrings', 'any', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 3::smallint, 5::smallint, 'nordic', 'Slow lowering, hands catch.'),
    (b2, 5::smallint, 10::smallint, 'Cuff Knee Extension (full range)', 'quads', 'any', 'per_leg', 'cuff',
      null, null, null, null, 'full_range_knee_extension', 'Left first.'),
    (b3, 1::smallint, 10::smallint, 'Front Squat (full depth)', 'quads', 'any', 'bilateral', 'barbell',
      null, null, null, null, 'depth_past_90', null),
    (b3, 3::smallint, 10::smallint, 'Nordic Curl (eccentric)', 'hamstrings', 'any', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 3::smallint, 5::smallint, 'nordic', 'Slow lowering, hands catch.'),
    (b3, 5::smallint, 10::smallint, 'Cuff Knee Extension (full range)', 'quads', 'any', 'per_leg', 'cuff',
      null, null, null, null, 'full_range_knee_extension', 'Left first.'),
    (b3, 5::smallint, 11::smallint, 'Box Jump (step down)', null, 'normal', 'bilateral', 'bodyweight',
      4::smallint, 4::smallint, 3::smallint, 3::smallint, 'plyo', 'Step down, never jump down.'),
    (b3, 3::smallint, 11::smallint, 'Single-Leg Hop and Stick', null, 'normal', 'per_leg', 'bodyweight',
      3::smallint, 3::smallint, 5::smallint, 5::smallint, 'single_leg_hops', 'Left first. Stick each landing 2 s.')
  ) as g(block_id, day, ord, name, muscle, readiness, side, load,
         sets_min, sets_max, reps_min, reps_max, gate, notes)
    on ps.block_id = g.block_id and ps.day_of_week = g.day
   and ps.sort_order = 0 and ps.session_type = 'lift'
  on conflict (program_session_id, exercise_order) do nothing;
end
$$;
