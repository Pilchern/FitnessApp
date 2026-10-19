-- Seeds the post-op program, gates, settings and the daily ROM habit for the
-- app's single owner.
--
-- Idempotent: every insert is keyed on a natural unique key (or "where not
-- exists") and does nothing when the row exists, so a rerun adds only what
-- is missing and never overwrites edits made in the app. No-op on a database
-- without a profile. No loads are written: leg loads come from the
-- progression engine, upper loads from what was last logged.
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
  insert into public.program_gates (user_id, gate_key, label, earliest_on)
  values
    (uid, 'barbell', 'Barbell cleared', null),
    (uid, 'depth_past_90', 'Depth past 90°', null),
    (uid, 'full_range_knee_extension', 'Full-range knee extension', null),
    (uid, 'nordic', 'Nordic curl', null),
    (uid, 'jog', 'Jog', date '2026-10-26'),
    (uid, 'plyo', 'Plyo (single-leg)', date '2026-11-09'),
    (uid, 'golf_short_game', 'Golf short game', null),
    (uid, 'golf_full_swing', 'Golf full swing', null),
    (uid, 'cutting', 'Cutting', null),
    (uid, 'return_to_sport', 'Return to sport', date '2027-05-17')
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
    (uid, pid, 'Deload + Test', 13, 13, null, null, null, null, null,
     'Block 1 minus 1 set, no load increases', 'Retest in the PT Tracker this week.'),
    (uid, pid, 'Block 2 Strength', 14, 17, 4, 4, 6, 8, 2,
     '4 x 6–8 @ RIR 2', null),
    (uid, pid, 'Deload', 18, 18, null, null, null, null, null,
     'Block 2 minus 1 set, no load increases', null),
    (uid, pid, 'Block 3 Heavy + Power', 19, 22, 4, 5, 3, 5, 2,
     '4–5 x 3–5 @ RIR 2', null),
    (uid, pid, 'Block 4 Sport Prep', 23, 38, null, null, null, null, null,
     'Alternating 4-week strength / power waves', 'Sessions to be added (Phase C).'),
    (uid, pid, 'Return to Sport + Maintenance', 39, 520, null, null, null, null, null,
     'Maintenance', 'Sessions to be added (Phase C).')
  on conflict (program_id, name) do nothing;

  select id into b_onramp from public.program_blocks where program_id = pid and name = 'On-ramp';
  select id into b1 from public.program_blocks where program_id = pid and name = 'Block 1 Build';
  select id into b_deload1 from public.program_blocks where program_id = pid and name = 'Deload + Test';
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

  -- Sessions: the same week shape in On-ramp and Blocks 1-3 -------------------
  insert into public.program_sessions
    (user_id, block_id, day_of_week, sort_order, session_type, name,
     ride_kind, minutes_min, minutes_max, structure, notes)
  select uid, b.id, s.day, s.sort, s.kind, s.name,
    s.ride, s.min_m, s.max_m, s.structure, s.notes
  from (values (b_onramp), (b1), (b2), (b3)) as b(id)
  cross join (values
    (1::smallint, 0::smallint, 'lift', 'Heavy legs + Push', null::text, null::smallint, null::smallint, null::text,
     'Legs first, then Push. Seated or supported DB work; on and off the bench leading with the right leg.'),
    (3::smallint, 0::smallint, 'lift', 'Single-leg + Pull', null, null, null, null,
     'PT this morning. Legs, then Pull, then the balance and gait finish.'),
    (5::smallint, 0::smallint, 'lift', 'Quad isolation + Arms', null, null, null, null,
     'PT this morning. Quad work first, then Arms.'),
    (2::smallint, 1::smallint, 'peloton', 'Peloton Zone 2', 'zone2', 30::smallint, 45::smallint, null, null),
    (6::smallint, 1::smallint, 'peloton', 'Peloton Zone 2 (long)', 'zone2', 45::smallint, 60::smallint, null, null),
    (0::smallint, 0::smallint, 'test', 'Test day + walk', null, null, null,
     'Strength and gait tests in the PT Tracker, then an easy walk.', null)
  ) as s(day, sort, kind, name, ride, min_m, max_m, structure, notes)
  on conflict (block_id, day_of_week, sort_order) do nothing;

  -- Thursday: Zone 2 in the On-ramp, seated climb intervals from week 10.
  insert into public.program_sessions
    (user_id, block_id, day_of_week, sort_order, session_type, name,
     ride_kind, minutes_min, minutes_max, structure)
  select uid, b.id, 4, 1, 'peloton',
    case when b.id = b_onramp then 'Peloton Zone 2' else 'Peloton climb intervals' end,
    case when b.id = b_onramp then 'zone2' else 'climb_intervals' end,
    case when b.id = b_onramp then 30 else 45 end,
    45,
    case when b.id = b_onramp then null
      else '10 min warm-up; 5 x 3 min seated, cadence 60–70, RPE 7, 3 min easy between; cool-down.' end
  from (values (b_onramp), (b1), (b2), (b3)) as b(id)
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

  -- Exercise slots, the same in On-ramp and Blocks 1-3 ------------------------
  -- Numbers are Block 1's. Loaded leg lifts (follows_block) take the block's
  -- sets/reps/RIR in the On-ramp and Blocks 2-3 instead. Order: legs 0-19,
  -- upper 30-39, the Wednesday balance and gait finish 40+.
  insert into public.program_exercises
    (user_id, program_session_id, exercise_order, exercise_name, block_part,
     primary_muscle, readiness_requirement, measure, side_mode, load_kind,
     sets_min, sets_max, reps_min, reps_max, rir_target, seconds_target, tempo,
     gate_key, substitute_name, substitute_load_kind, from_week, until_week, notes)
  select uid, ps.id, e.ord, e.name, e.part,
    e.muscle, e.readiness, e.measure, e.side, e.load,
    case when e.follows_block and ps.block_id <> b1 then null else e.sets_min end,
    case when e.follows_block and ps.block_id <> b1 then null else e.sets_max end,
    case when e.follows_block and ps.block_id <> b1 then null else e.reps_min end,
    case when e.follows_block and ps.block_id <> b1 then null else e.reps_max end,
    e.rir, e.secs, e.tempo, e.gate, e.sub, e.sub_load, e.from_week, e.until_week, e.notes
  from public.program_sessions ps
  join (values
    -- Monday: heavy legs, then Push
    (1::smallint, 0::smallint, 'Barbell Pin Squat (to 90°)', 'legs', 'quads', 'any', 'reps', 'bilateral', 'barbell',
      4::smallint, 4::smallint, 10::smallint, 10::smallint, null::numeric, null::smallint, null::text,
      'barbell', 'Goblet Box Squat (to 90°)', 'dumbbell', null::smallint, null::smallint,
      'Pins at 90°. Goblet box squat until the barbell gate is on.', true),
    (1::smallint, 1::smallint, 'Cuff Knee Extension (90→45°)', 'legs', 'quads', 'any', 'reps', 'per_leg', 'cuff',
      3::smallint, 3::smallint, 12::smallint, 15::smallint, null, null, null, null, null, null, null, null,
      'Left first. Plate or DB hangs from the ankle cuff. Stop at 45°.', true),
    (1::smallint, 2::smallint, 'Barbell Hip Thrust', 'legs', 'glutes', 'any', 'reps', 'bilateral', 'barbell',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, null, null, null, true),
    (1::smallint, 3::smallint, 'Single-Leg Calf Raise', 'legs', 'calves', 'any', 'reps', 'per_leg', 'dumbbell',
      3::smallint, 3::smallint, 12::smallint, 12::smallint, null, null, null, null, null, null, null, null, 'Left first.', true),
    (1::smallint, 30::smallint, 'Barbell Bench Press', 'upper', null, 'any', 'reps', 'bilateral', 'barbell',
      3::smallint, 3::smallint, 8::smallint, 8::smallint, 2::numeric, null, null, null, null, null, null, null,
      'Feet flat; do not tuck the left foot under the bench.', false),
    (1::smallint, 31::smallint, 'Incline Dumbbell Press', 'upper', null, 'any', 'reps', 'bilateral', 'dumbbell',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, 2::numeric, null, null, null, null, null, null, null, null, false),
    (1::smallint, 32::smallint, 'Dumbbell Shoulder Press', 'upper', null, 'any', 'reps', 'bilateral', 'dumbbell',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, 2::numeric, null, null, null, null, null, null, null, 'Seated.', false),
    (1::smallint, 33::smallint, 'Lateral Raise', 'upper', null, 'any', 'reps', 'bilateral', 'dumbbell',
      3::smallint, 3::smallint, 15::smallint, 20::smallint, 2::numeric, null, null, null, null, null, null, null, null, false),
    (1::smallint, 34::smallint, 'Tricep Extension', 'upper', null, 'any', 'reps', 'bilateral', 'dumbbell',
      2::smallint, 2::smallint, 15::smallint, 15::smallint, 2::numeric, null, null, null, null, null, null, null, 'Overhead, seated.', false),
    (1::smallint, 35::smallint, 'Dead Bug', 'upper', null, 'any', 'reps', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, null, null,
      'Down to the floor leading with the right leg.', false),
    -- Wednesday: single-leg, then Pull, then balance and gait
    (3::smallint, 0::smallint, 'DB Step-Up (12")', 'legs', 'quads', 'any', 'reps', 'per_leg', 'dumbbell',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, null, null, '3-sec lowering', null, null, null, null, null, 'Left first.', true),
    (3::smallint, 1::smallint, 'Split Squat (to 90°)', 'legs', 'quads', 'any', 'reps', 'per_leg', 'dumbbell',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, null, 10::smallint, 'Left first.', true),
    (3::smallint, 2::smallint, 'Rear-Foot-Elevated Split Squat (to 90°)', 'legs', 'quads', 'any', 'reps', 'per_leg', 'dumbbell',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, 11::smallint, null, 'Left first.', true),
    (3::smallint, 3::smallint, 'Slider Hamstring Curl', 'legs', 'hamstrings', 'any', 'reps', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, null, null, null, false),
    (3::smallint, 30::smallint, 'Pull-Up', 'upper', null, 'any', 'reps', 'bilateral', 'bodyweight',
      4::smallint, 4::smallint, 3::smallint, 5::smallint, 1::numeric, null, null, null, null, null, null, null,
      'Reach the bar from the bench; step down onto the bench with the right leg. No jumping or dropping.', false),
    (3::smallint, 31::smallint, 'Dumbbell Row', 'upper', null, 'any', 'reps', 'bilateral', 'dumbbell',
      4::smallint, 4::smallint, 10::smallint, 12::smallint, 2::numeric, null, null, null, null, null, null, null, 'Bench-supported, 1-arm.', false),
    (3::smallint, 32::smallint, 'Face Pull', 'upper', null, 'any', 'reps', 'bilateral', 'band',
      3::smallint, 3::smallint, 20::smallint, 20::smallint, 2::numeric, null, null, null, null, null, null, null, 'Band.', false),
    (3::smallint, 33::smallint, 'Rear Delt Fly', 'upper', null, 'any', 'reps', 'bilateral', 'dumbbell',
      3::smallint, 3::smallint, 15::smallint, 15::smallint, 2::numeric, null, null, null, null, null, null, null, 'Chest-supported on an incline bench.', false),
    (3::smallint, 34::smallint, 'Dumbbell Curl', 'upper', null, 'any', 'reps', 'bilateral', 'dumbbell',
      2::smallint, 2::smallint, 15::smallint, 15::smallint, 2::numeric, null, null, null, null, null, null, null, null, false),
    (3::smallint, 40::smallint, 'Copenhagen Side Plank (short lever)', 'legs', 'adductors', 'any', 'time', 'per_leg', 'bodyweight',
      3::smallint, 3::smallint, null, null, null, 20::smallint, null, null, null, null, null, null, 'Seconds per side.', false),
    (3::smallint, 41::smallint, 'Perturbation Balance', 'legs', null, 'any', 'time', 'per_leg', 'bodyweight',
      3::smallint, 3::smallint, null, null, null, 30::smallint, null, null, null, null, null, null, 'Seconds per side.', false),
    (3::smallint, 42::smallint, 'Gait Drill', 'legs', null, 'any', 'time', 'bilateral', 'bodyweight',
      1::smallint, 1::smallint, null, null, null, 300::smallint, null, null, null, null, null, null, '5 min.', false),
    -- Friday: quad isolation and running prep, then Arms
    (5::smallint, 0::smallint, 'Spanish Squat', 'legs', 'quads', 'any', 'time', 'bilateral', 'band',
      3::smallint, 3::smallint, null, null, null, 45::smallint, null, null, null, null, null, null, null, false),
    (5::smallint, 1::smallint, 'Isometric Knee Extension (90°)', 'legs', 'quads', 'any', 'force', 'per_leg', 'bodyweight',
      5::smallint, 5::smallint, null, null, null, 5::smallint, null, null, null, null, null, null,
      'Strapped, 5 s max effort. Log peak newtons from the crane scale. Left first.', false),
    (5::smallint, 2::smallint, 'Heel-Elevated Goblet Squat (to 90°)', 'legs', 'quads', 'any', 'reps', 'bilateral', 'dumbbell',
      3::smallint, 3::smallint, 12::smallint, 12::smallint, null, null, '3-1-1', null, null, null, null, null, null, true),
    (5::smallint, 3::smallint, 'DB Single-Leg RDL', 'legs', 'hamstrings', 'any', 'reps', 'per_leg', 'dumbbell',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, null, null, 'Left first.', true),
    (5::smallint, 4::smallint, 'Bent-Knee Calf Raise', 'legs', 'calves', 'any', 'reps', 'bilateral', 'dumbbell',
      3::smallint, 3::smallint, 15::smallint, 15::smallint, null, null, null, null, null, null, null, null, null, true),
    (5::smallint, 10::smallint, 'Squat to Calf Raise', 'legs', null, 'normal', 'reps', 'bilateral', 'bodyweight',
      2::smallint, 2::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, 10::smallint, null, 'Landing prep.', false),
    (5::smallint, 11::smallint, 'Snap-Down to Stick', 'legs', null, 'normal', 'reps', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 5::smallint, 5::smallint, null, null, null, null, null, null, 10::smallint, null, 'Landing prep. No flight phase.', false),
    (5::smallint, 12::smallint, 'Double-Leg Pogo', 'legs', null, 'normal', 'reps', 'bilateral', 'bodyweight',
      2::smallint, 2::smallint, 10::smallint, 10::smallint, null, null, null, 'plyo', null, null, 10::smallint, null,
      'Landing prep. Has a flight phase, so it waits for the plyo gate (PT sign-off).', false),
    (5::smallint, 30::smallint, 'Close-Grip Bench Press', 'upper', null, 'any', 'reps', 'bilateral', 'barbell',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, 2::numeric, null, null, null, null, null, null, null,
      'Feet flat; do not tuck the left foot under the bench.', false),
    (5::smallint, 31::smallint, 'Chin-Up', 'upper', null, 'any', 'reps', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 3::smallint, 5::smallint, 1::numeric, null, null, null, null, null, null, null,
      'Reach the bar from the bench; step down onto the bench with the right leg.', false),
    (5::smallint, 32::smallint, 'Hammer Curl', 'upper', null, 'any', 'reps', 'bilateral', 'dumbbell',
      2::smallint, 2::smallint, 15::smallint, 15::smallint, 2::numeric, null, null, null, null, null, null, null, null, false),
    (5::smallint, 33::smallint, 'Band Anti-Rotation Press', 'upper', null, 'any', 'reps', 'bilateral', 'band',
      3::smallint, 3::smallint, 10::smallint, 10::smallint, null, null, null, null, null, null, null, null,
      'Pallof press, 10 per side. Stand, or kneel on the right knee only.', false)
  ) as e(day, ord, name, part, muscle, readiness, measure, side, load,
         sets_min, sets_max, reps_min, reps_max, rir, secs, tempo,
         gate, sub, sub_load, from_week, until_week, notes, follows_block)
    on ps.day_of_week = e.day and ps.sort_order = 0 and ps.session_type = 'lift'
  where ps.user_id = uid and ps.block_id in (b_onramp, b1, b2, b3)
  on conflict (program_session_id, exercise_order) do nothing;

  -- Gated slots for Blocks 2-3 (hidden or greyed until cleared) --------------
  insert into public.program_exercises
    (user_id, program_session_id, exercise_order, exercise_name, block_part,
     primary_muscle, readiness_requirement, measure, side_mode, load_kind,
     sets_min, sets_max, reps_min, reps_max, gate_key, notes)
  select uid, ps.id, g.ord, g.name, 'legs', g.muscle, g.readiness, 'reps', g.side, g.load,
    g.sets_min, g.sets_max, g.reps_min, g.reps_max, g.gate, g.notes
  from public.program_sessions ps
  join (values
    (1::smallint, 4::smallint, 'Front Squat (full depth)', 'quads', 'any', 'bilateral', 'barbell',
      null::smallint, null::smallint, null::smallint, null::smallint, 'depth_past_90', 'Or a deep goblet squat.', 2),
    (3::smallint, 4::smallint, 'Nordic Curl (eccentric)', 'hamstrings', 'any', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 3::smallint, 5::smallint, 'nordic', 'Slow lowering, hands catch.', 2),
    (3::smallint, 43::smallint, 'Lead-Leg Posting (golf)', null, 'normal', 'per_leg', 'bodyweight',
      2::smallint, 2::smallint, 8::smallint, 8::smallint, 'golf_short_game', 'Left (lead) leg.', 2),
    (3::smallint, 44::smallint, 'Step-and-Rotate (golf)', null, 'normal', 'bilateral', 'bodyweight',
      2::smallint, 2::smallint, 8::smallint, 8::smallint, 'golf_short_game', null, 2),
    (3::smallint, 45::smallint, 'Band-Resisted Rotation (golf)', null, 'normal', 'bilateral', 'band',
      2::smallint, 2::smallint, 10::smallint, 10::smallint, 'golf_short_game', 'Per side.', 2),
    (5::smallint, 5::smallint, 'Cuff Knee Extension (full range)', 'quads', 'any', 'per_leg', 'cuff',
      null, null, null, null, 'full_range_knee_extension', 'Left first.', 2),
    (5::smallint, 13::smallint, 'Drop-Squat Landing', null, 'normal', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 5::smallint, 5::smallint, 'plyo', null, 2),
    (5::smallint, 14::smallint, 'Low Box Jump (step down)', null, 'normal', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 5::smallint, 5::smallint, 'plyo', 'Step down, never jump down.', 2),
    (5::smallint, 15::smallint, 'Jump Squat', null, 'normal', 'bilateral', 'bodyweight',
      3::smallint, 3::smallint, 5::smallint, 5::smallint, 'plyo', null, 3),
    (5::smallint, 16::smallint, 'Single-Leg Hop and Stick', null, 'normal', 'per_leg', 'bodyweight',
      3::smallint, 3::smallint, 5::smallint, 5::smallint, 'plyo', 'Left first. Stick each landing 2 s.', 3),
    (5::smallint, 17::smallint, 'Lateral Bound', null, 'normal', 'per_leg', 'bodyweight',
      3::smallint, 3::smallint, 5::smallint, 5::smallint, 'plyo', 'Stick each landing.', 3)
  ) as g(day, ord, name, muscle, readiness, side, load,
         sets_min, sets_max, reps_min, reps_max, gate, notes, first_block)
    on ps.day_of_week = g.day and ps.sort_order = 0 and ps.session_type = 'lift'
  where ps.user_id = uid
    and (ps.block_id = b3 or (ps.block_id = b2 and g.first_block = 2))
  on conflict (program_session_id, exercise_order) do nothing;

  -- Daily ROM check as a habit (the existing habits list) ---------------------
  insert into public.supplements (user_id, name, kind)
  select uid, 'ROM check 5 min (prone hang, heel slides)', 'habit'
  where not exists (
    select 1 from public.supplements
    where user_id = uid and name = 'ROM check 5 min (prone hang, heel slides)'
      and deleted_at is null
  );

  -- Targets and thresholds (edit in Settings) --------------------------------
  insert into public.training_settings
    (user_id, key, value, text_value, label, unit, group_name, sort_order)
  values
    (uid, 'barbell_step_lb', 5, null, 'Barbell increase', 'lb', 'Progression', 10),
    (uid, 'dumbbell_fine_step_lb', 2.5, null, 'Dumbbell step up to the limit below', 'lb', 'Progression', 20),
    (uid, 'dumbbell_fine_limit_lb', 25, null, 'Dumbbell fine-step limit', 'lb', 'Progression', 30),
    (uid, 'dumbbell_coarse_step_lb', 5, null, 'Dumbbell step above the limit', 'lb', 'Progression', 40),
    (uid, 'cuff_step_lb', 2.5, null, 'Ankle cuff increase', 'lb', 'Progression', 50),
    (uid, 'progression_min_rir', 2, null, 'Min reps in reserve on every set to add load', 'RIR', 'Progression', 60),
    (uid, 'sleep_min_hours_for_increase', 6.5, null, 'No load increase below this sleep average', 'h', 'Progression', 70),
    (uid, 'sleep_average_nights', 3, null, 'Nights in that sleep average', 'nights', 'Progression', 80),
    (uid, 'hard_set_max_rir', 4, null, 'A hard set is at or under this RIR', 'RIR', 'Progression', 90),
    (uid, 'quad_sets_min', 12, null, 'Weekly hard quad sets, low end', 'sets', 'Progression', 100),
    (uid, 'quad_sets_max', 16, null, 'Weekly hard quad sets, high end', 'sets', 'Progression', 110),
    (uid, 'readiness_normal_max_pain', 2, null, 'Normal day: graft pain at or under', '/10', 'Knee check', 10),
    (uid, 'readiness_knee_off_above_pain', 3, null, 'Knee day off: graft pain above', '/10', 'Knee check', 20),
    (uid, 'knee_off_streak_days', 2, null, 'Knee-off days in a row before "go back a week"', 'days', 'Knee check', 30),
    (uid, 'knee_off_block_minutes', 15, null, 'ROM + walk block on a knee day off', 'min', 'Knee check', 40),
    (uid, 'ortho_name', null, 'OrthoIllinois', 'Red flag: who to call', null, 'Knee check', 50),
    (uid, 'ortho_phone', null, null, 'Red flag: phone number', null, 'Knee check', 60),
    (uid, 'walk_jog_start_run_min', 1, null, 'Walk-jog start: jog interval', 'min', 'Walk-jog', 10),
    (uid, 'walk_jog_start_walk_min', 1, null, 'Walk-jog start: walk interval', 'min', 'Walk-jog', 20),
    (uid, 'walk_jog_start_rounds', 6, null, 'Walk-jog start: rounds', 'rounds', 'Walk-jog', 30),
    (uid, 'walk_jog_step_min', 1, null, 'Add running per session, low end', 'min', 'Walk-jog', 40),
    (uid, 'walk_jog_step_max', 2, null, 'Add running per session, high end', 'min', 'Walk-jog', 50),
    (uid, 'walk_jog_rest_days', 2, null, 'Days off running after a non-normal check', 'days', 'Walk-jog', 60),
    (uid, 'ride_after_walk_jog_min', 15, null, 'Ride after walk-jog, shortest', 'min', 'Walk-jog', 70),
    (uid, 'ride_after_walk_jog_max', 20, null, 'Ride after walk-jog, longest', 'min', 'Walk-jog', 80)
  on conflict (user_id, key) do nothing;
end
$$;
