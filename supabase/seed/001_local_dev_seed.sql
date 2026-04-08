do $$
declare
  v_user_id constant uuid := '11111111-1111-4111-8111-111111111111';
  v_profile_id constant uuid := '11111111-2222-4111-8111-111111111111';
  v_tuesday_zone2_template_id constant uuid := '22222222-0001-4222-8222-222222222222';
  v_thursday_vo2_template_id constant uuid := '22222222-0002-4222-8222-222222222222';
  v_saturday_long_zone2_template_id constant uuid := '22222222-0003-4222-8222-222222222222';
  v_weekly_review_id constant uuid := '33333333-0001-4333-8333-333333333333';
  v_strength_session_1_id constant uuid := '99999999-0001-4999-8999-999999999999';
  v_strength_session_2_id constant uuid := '99999999-0002-4999-8999-999999999999';
  v_strength_session_3_id constant uuid := '99999999-0003-4999-8999-999999999999';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'dev@example.com',
    crypt('password1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Ashley Dev"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    '44444444-0001-4444-8444-444444444444',
    v_user_id,
    format('{"sub":"%s","email":"%s"}', v_user_id, 'dev@example.com')::jsonb,
    'email',
    now(),
    now(),
    now()
  )
  on conflict (id) do nothing;

  insert into public.profiles (
    id,
    user_id,
    display_name,
    timezone,
    units_system,
    week_starts_on,
    goal_fat_loss,
    goal_preserve_muscle,
    goal_improve_vo2,
    baseline_schedule
  )
  values (
    v_profile_id,
    v_user_id,
    'Ashley Dev',
    'America/Chicago',
    'imperial',
    1,
    true,
    true,
    true,
    '{
      "monday": ["lift"],
      "tuesday": ["zone2_peloton_45_60"],
      "wednesday": ["lift"],
      "thursday": ["vo2_peloton_30_40"],
      "friday": ["lift"],
      "saturday": ["long_zone2_peloton_45_75"],
      "sunday": ["recovery"]
    }'::jsonb
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    timezone = excluded.timezone,
    units_system = excluded.units_system,
    week_starts_on = excluded.week_starts_on,
    goal_fat_loss = excluded.goal_fat_loss,
    goal_preserve_muscle = excluded.goal_preserve_muscle,
    goal_improve_vo2 = excluded.goal_improve_vo2,
    baseline_schedule = excluded.baseline_schedule;

  insert into public.training_templates (id, user_id, name, template_type, definition)
  values
    (
      v_tuesday_zone2_template_id,
      v_user_id,
      'Tuesday Zone 2 Peloton',
      'cardio',
      '{
        "session_kind": "zone2",
        "target_duration_minutes": 55,
        "target_zone2_minutes": 45,
        "equipment": "peloton",
        "notes": "Steady conversational effort."
      }'::jsonb
    ),
    (
      v_thursday_vo2_template_id,
      v_user_id,
      'Thursday VO2 Peloton',
      'cardio',
      '{
        "session_kind": "vo2",
        "target_duration_minutes": 35,
        "work_interval_minutes": 4,
        "recovery_interval_minutes": 3,
        "rounds": 4,
        "equipment": "peloton"
      }'::jsonb
    ),
    (
      v_saturday_long_zone2_template_id,
      v_user_id,
      'Saturday Long Zone 2 Peloton',
      'cardio',
      '{
        "session_kind": "zone2",
        "target_duration_minutes": 70,
        "target_zone2_minutes": 60,
        "equipment": "peloton",
        "notes": "Longer easy aerobic ride."
      }'::jsonb
    )
  on conflict (id) do update
  set
    name = excluded.name,
    template_type = excluded.template_type,
    definition = excluded.definition,
    deleted_at = null;

  insert into public.body_metrics (
    id,
    user_id,
    measured_on,
    weight_lb,
    weight_kg,
    waist_in,
    waist_cm,
    body_fat_pct,
    muscle_mass_lb,
    muscle_mass_kg,
    source_type,
    notes
  )
  values
    ('55555555-0001-4555-8555-555555555555', v_user_id, '2026-03-08', 191.6, 86.91, 35.0, 88.90, 24.5, 143.8, 65.23, 'manual', 'Sunday morning check-in.'),
    ('55555555-0002-4555-8555-555555555555', v_user_id, '2026-03-15', 190.9, 86.59, 34.8, 88.39, 24.1, 144.0, 65.32, 'manual', 'Steady progress.'),
    ('55555555-0003-4555-8555-555555555555', v_user_id, '2026-03-22', 190.1, 86.23, 34.6, 87.88, 23.8, 144.1, 65.36, 'manual', 'Waist trending down.'),
    ('55555555-0004-4555-8555-555555555555', v_user_id, '2026-03-29', 189.4, 85.91, 34.3, 87.12, 23.5, 144.3, 65.45, 'manual', 'Good end-of-week trend.')
  on conflict (id) do update
  set
    measured_on = excluded.measured_on,
    weight_lb = excluded.weight_lb,
    weight_kg = excluded.weight_kg,
    waist_in = excluded.waist_in,
    waist_cm = excluded.waist_cm,
    body_fat_pct = excluded.body_fat_pct,
    muscle_mass_lb = excluded.muscle_mass_lb,
    muscle_mass_kg = excluded.muscle_mass_kg,
    source_type = excluded.source_type,
    notes = excluded.notes,
    deleted_at = null;

  insert into public.recovery_checkins (
    id,
    user_id,
    checkin_date,
    resting_heart_rate,
    hrv,
    sleep_duration_minutes,
    sleep_quality,
    energy_level,
    readiness_level,
    stress_level,
    soreness_level,
    alcohol_count,
    notes,
    source_type
  )
  values
    ('66666666-0001-4666-8666-666666666666', v_user_id, '2026-03-24', 56, 47.0, 442, 4, 4, 7, 3, 4, 0, 'Felt solid heading into Zone 2 ride.', 'manual'),
    ('66666666-0002-4666-8666-666666666666', v_user_id, '2026-03-26', 58, 43.5, 401, 3, 3, 5, 6, 5, 1, 'Slightly flat before intervals.', 'manual'),
    ('66666666-0003-4666-8666-666666666666', v_user_id, '2026-03-28', 55, 48.8, 465, 4, 4, 8, 2, 3, 0, 'Recovered well for the long ride.', 'manual')
  on conflict (id) do update
  set
    checkin_date = excluded.checkin_date,
    resting_heart_rate = excluded.resting_heart_rate,
    hrv = excluded.hrv,
    sleep_duration_minutes = excluded.sleep_duration_minutes,
    sleep_quality = excluded.sleep_quality,
    energy_level = excluded.energy_level,
    readiness_level = excluded.readiness_level,
    stress_level = excluded.stress_level,
    soreness_level = excluded.soreness_level,
    alcohol_count = excluded.alcohol_count,
    notes = excluded.notes,
    source_type = excluded.source_type,
    deleted_at = null;

  insert into public.cardio_sessions (
    id,
    user_id,
    training_template_id,
    session_date,
    started_at,
    ended_at,
    session_kind,
    duration_minutes,
    zone2_minutes,
    avg_heart_rate,
    max_heart_rate,
    distance_meters,
    source_type,
    notes
  )
  values
    (
      '77777777-0001-4777-8777-777777777777',
      v_user_id,
      v_tuesday_zone2_template_id,
      '2026-03-24',
      '2026-03-24T18:10:00-05:00',
      '2026-03-24T19:02:00-05:00',
      'zone2',
      52,
      46,
      136,
      149,
      24400,
      'manual',
      'Kept it smooth and conversational.'
    ),
    (
      '77777777-0002-4777-8777-777777777777',
      v_user_id,
      v_thursday_vo2_template_id,
      '2026-03-26',
      '2026-03-26T18:05:00-05:00',
      '2026-03-26T18:41:00-05:00',
      'vo2',
      36,
      14,
      149,
      174,
      16500,
      'manual',
      'Completed all interval rounds, but effort felt high.'
    ),
    (
      '77777777-0003-4777-8777-777777777777',
      v_user_id,
      v_saturday_long_zone2_template_id,
      '2026-03-28',
      '2026-03-28T09:12:00-05:00',
      '2026-03-28T10:24:00-05:00',
      'zone2',
      72,
      61,
      133,
      145,
      32200,
      'manual',
      'Felt relaxed and consistent for the full session.'
    )
  on conflict (id) do update
  set
    training_template_id = excluded.training_template_id,
    session_date = excluded.session_date,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    session_kind = excluded.session_kind,
    duration_minutes = excluded.duration_minutes,
    zone2_minutes = excluded.zone2_minutes,
    avg_heart_rate = excluded.avg_heart_rate,
    max_heart_rate = excluded.max_heart_rate,
    distance_meters = excluded.distance_meters,
    source_type = excluded.source_type,
    notes = excluded.notes,
    deleted_at = null;

  insert into public.strength_sessions (
    id,
    user_id,
    session_date,
    session_name,
    duration_minutes,
    readiness_pre,
    energy_post,
    completed_as_planned,
    source_type,
    notes
  )
  values
    (v_strength_session_1_id, v_user_id, '2026-03-17', 'Upper A', 61, 7, 7, true, 'manual', 'Bench felt steady.'),
    (v_strength_session_2_id, v_user_id, '2026-03-24', 'Upper A', 63, 6, 6, true, 'manual', 'Same top set, slightly slower bar speed.'),
    (v_strength_session_3_id, v_user_id, '2026-03-31', 'Upper A', 64, 6, 5, true, 'manual', 'Third week without a clear top set improvement.')
  on conflict (id) do update
  set
    session_date = excluded.session_date,
    session_name = excluded.session_name,
    duration_minutes = excluded.duration_minutes,
    readiness_pre = excluded.readiness_pre,
    energy_post = excluded.energy_post,
    completed_as_planned = excluded.completed_as_planned,
    source_type = excluded.source_type,
    notes = excluded.notes,
    deleted_at = null;

  insert into public.strength_exercise_sets (
    id,
    user_id,
    strength_session_id,
    exercise_name,
    exercise_order,
    set_order,
    reps,
    weight,
    rir,
    notes
  )
  values
    ('aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_1_id, 'Bench Press', 0, 1, 5, 185, 2, null),
    ('aaaaaaaa-0002-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_1_id, 'Bench Press', 0, 2, 5, 185, 2, null),
    ('aaaaaaaa-0003-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_1_id, 'Chest Supported Row', 1, 1, 8, 90, 2, null),
    ('aaaaaaaa-0004-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_2_id, 'Bench Press', 0, 1, 5, 185, 2, null),
    ('aaaaaaaa-0005-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_2_id, 'Bench Press', 0, 2, 5, 185, 2, null),
    ('aaaaaaaa-0006-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_2_id, 'Chest Supported Row', 1, 1, 8, 95, 2, null),
    ('aaaaaaaa-0007-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_3_id, 'Bench Press', 0, 1, 5, 185, 1, null),
    ('aaaaaaaa-0008-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_3_id, 'Bench Press', 0, 2, 5, 185, 1, null),
    ('aaaaaaaa-0009-4aaa-8aaa-aaaaaaaaaaaa', v_user_id, v_strength_session_3_id, 'Chest Supported Row', 1, 1, 8, 95, 2, null)
  on conflict (id) do update
  set
    strength_session_id = excluded.strength_session_id,
    exercise_name = excluded.exercise_name,
    exercise_order = excluded.exercise_order,
    set_order = excluded.set_order,
    reps = excluded.reps,
    weight = excluded.weight,
    rir = excluded.rir,
    notes = excluded.notes,
    deleted_at = null;

  insert into public.weekly_reviews (
    id,
    user_id,
    week_start,
    week_end,
    status,
    summary,
    best_win,
    biggest_miss,
    lesson,
    next_week_priority,
    confidence,
    score_details,
    strategic_decision,
    risk_forecast,
    manual_overrides,
    completed_at
  )
  values (
    v_weekly_review_id,
    v_user_id,
    '2026-03-23',
    '2026-03-29',
    'completed',
    '{
      "averageWeightLb": 189.8,
      "waistIn": 34.3,
      "liftsCompleted": 3,
      "ridesCompleted": 3,
      "zone2Minutes": 107,
      "vo2Completed": true,
      "sleepAverageHours": 7.3,
      "alcoholTotal": 1
    }'::jsonb,
    'Three quality cardio sessions and a continued downward waist trend.',
    'Thursday intervals pushed a little too hard after a shorter sleep night.',
    'Protecting Wednesday night sleep matters more than squeezing out a little more Thursday intensity.',
    'Keep Thursday intensity controlled and protect Wednesday night sleep.',
    8,
    '{
      "version": "v1",
      "totalScore": 89,
      "band": "strong",
      "components": [
        { "key": "lifts", "label": "Lifts completed", "score": 25, "maxScore": 25, "detail": "3/3 target lifts logged" },
        { "key": "rides", "label": "Rides completed", "score": 20, "maxScore": 20, "detail": "3/3 target rides completed" },
        { "key": "zone2", "label": "Zone 2 minutes", "score": 10, "maxScore": 10, "detail": "107 / 90 target Zone 2 minutes" },
        { "key": "vo2", "label": "VO2 session", "score": 5, "maxScore": 5, "detail": "VO2 session completed" },
        { "key": "sleep", "label": "Sleep average", "score": 16, "maxScore": 20, "detail": "7.3h average sleep" },
        { "key": "alcohol", "label": "Alcohol total", "score": 10, "maxScore": 10, "detail": "1 total drinks" },
        { "key": "confidence", "label": "Subjective confidence", "score": 8, "maxScore": 10, "detail": "8/10 confidence" }
      ]
    }'::jsonb,
    'Hold the plan and progress one lever modestly next week.',
    'Low risk: adherence and recovery are stable enough to carry momentum into next week.',
    '{}'::jsonb,
    '2026-03-29T20:00:00-05:00'
  )
  on conflict (id) do update
  set
    week_start = excluded.week_start,
    week_end = excluded.week_end,
    status = excluded.status,
    summary = excluded.summary,
    best_win = excluded.best_win,
    biggest_miss = excluded.biggest_miss,
    lesson = excluded.lesson,
    next_week_priority = excluded.next_week_priority,
    confidence = excluded.confidence,
    score_details = excluded.score_details,
    strategic_decision = excluded.strategic_decision,
    risk_forecast = excluded.risk_forecast,
    manual_overrides = excluded.manual_overrides,
    completed_at = excluded.completed_at,
    deleted_at = null;

  insert into public.journal_entries (
    id,
    user_id,
    entry_date,
    title,
    body,
    tags,
    related_week_start,
    related_weekly_review_id
  )
  values
    (
      '88888888-0001-4888-8888-888888888888',
      v_user_id,
      '2026-03-26',
      'VO2 day note',
      'Intervals were completed, but the ride felt harder than expected. Sleep and work stress probably contributed.',
      array['cardio', 'vo2', 'recovery'],
      '2026-03-23',
      v_weekly_review_id
    ),
    (
      '88888888-0002-4888-8888-888888888888',
      v_user_id,
      '2026-03-29',
      'Weekly reflection',
      'Consistency stayed high this week. The long Saturday ride felt sustainable, which is a good sign for aerobic progress.',
      array['review', 'consistency', 'zone2'],
      '2026-03-23',
      v_weekly_review_id
    )
  on conflict (id) do update
  set
    entry_date = excluded.entry_date,
    title = excluded.title,
    body = excluded.body,
    tags = excluded.tags,
    related_weekly_review_id = excluded.related_weekly_review_id,
    deleted_at = null;
end
$$;
