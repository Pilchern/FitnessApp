-- Program v2.18, part A (owner request 2026-11-09; plan entries v2.17 + v2.18).
--
-- Safe to apply before the v2.18 code deploys: nothing here uses a value the
-- old code rejects. The two leg-developer exercises (load_kind 'plate') are
-- part B, applied once the code that reads 'plate' is live.
--
-- 1. load_kind and substitute_load_kind accept 'plate' (the bench's leg
--    developer: seated extension, prone curl).
-- 2. Monday Block 1 "Legs + Push": Banded Knee Extension (90→45°) out,
--    "Isometric Knee Extension (strap, crane)" in as B2. Regroup:
--    A Pin Squat + Lateral Raise; B Bench + Iso KE + Pushdown;
--    C Hip Thrust + SL Calf Raise + Incline DB Press.
-- 3. Wednesday Block 1 "Single-leg + Pull": A Step-Up + Pull-Up (the
--    settings-gated Lateral Raise stays A3, now off); B RFESS + Row;
--    C Good Morning + Face Pull; D Slider Curl + DB Curl. Slider note.
-- 4. Friday Block 1 "Quad + Arms": existing rows regrouped to
--    B Goblet + Close-Grip Bench, C SL RDL + Tricep Ext + Hammer Curl
--    (part B adds Prone Leg Curl as A3 and Seated Leg Extension as B3).
-- 5. Block 2: Monday B Bench + Pushdown, C Hip Thrust + Calf + Incline,
--    Nordic straight sets; Friday Close-Grip Bench to B1 (part B adds the
--    Seated Leg Extension as B2), Tricep Ext + Nordic + Hammer D -> C.
--    Block 2 Wednesday has no Step-Up or Slider Curl: unchanged.
-- 6. Settings: gait drill 3 -> 0 min, shoulder emphasis 1 -> 0 (Wednesday
--    lateral raise off), new leg_developer_step_lb 2.5.
-- 7. Daily ROM check habit adds the prone heel-to-butt stretch (renamed in
--    place; logs keep their link).
-- 8. Cardio template: treadmill incline walk, Zone 2.
--
-- exercise_order drives display order; the unique key (session, order)
-- includes soft-deleted rows, so every new order below was checked free.
-- Idempotent: each update matches only the old state, inserts check first.

alter table public.program_exercises
  drop constraint if exists program_exercises_load_kind_check;
alter table public.program_exercises
  add constraint program_exercises_load_kind_check
  check (load_kind in ('barbell', 'dumbbell', 'cuff', 'bodyweight', 'band', 'plate'));
alter table public.program_exercises
  drop constraint if exists program_exercises_substitute_load_kind_check;
alter table public.program_exercises
  add constraint program_exercises_substitute_load_kind_check
  check (substitute_load_kind in ('barbell', 'dumbbell', 'cuff', 'bodyweight', 'band', 'plate'));

-- Lift sessions of the active program by block name and weekday.
create temp view v218_sessions as
select s.id, s.user_id, b.name as block_name, s.day_of_week
from public.program_sessions s
join public.program_blocks b on b.id = s.block_id and b.deleted_at is null
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.deleted_at is null and s.session_type = 'lift';

-- Re-slot one live exercise: order, superset group and position.
create function pg_temp.v218_slot(
  p_block text, p_day int, p_name text,
  p_order int, p_group text, p_pos int
) returns void language sql as $$
  update public.program_exercises e
  set exercise_order = p_order,
      superset_group = p_group,
      superset_order = p_pos,
      updated_at = now()
  from v218_sessions s
  where e.program_session_id = s.id
    and s.block_name = p_block and s.day_of_week = p_day
    and e.deleted_at is null and e.exercise_name = p_name
    and (e.exercise_order, e.superset_group, e.superset_order)
        is distinct from (p_order::smallint, p_group, p_pos::smallint);
$$;

-- 2. Monday, Block 1 -------------------------------------------------------

insert into public.program_exercises
  (user_id, program_session_id, exercise_order, exercise_name, block_part, primary_muscle,
   readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, seconds_target,
   category, counts_as_quad_set, left_extra_sets, superset_group, superset_order, cue, notes)
select s.user_id, s.id, 18, 'Isometric Knee Extension (strap, crane)', 'legs', 'quads',
  'any', 'force', 'per_leg', 'bodyweight', 7, 7, 5,
  'accessory', true, 0, 'B', 2,
  '5-s ramp, don''t jerk; strap level and perpendicular to the shin.',
  'Per leg, left first. Sets 1-5: 5 s max at 90°. Sets 6-7: 30-45 s at about 70% of that max at 60° (log the seconds). Log peak N every rep.'
from v218_sessions s
where s.block_name = 'Block 1 Build' and s.day_of_week = 1
  and not exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null
      and x.exercise_name = 'Isometric Knee Extension (strap, crane)'
  )
on conflict (program_session_id, exercise_order) do nothing;

update public.program_exercises e
set deleted_at = now(), updated_at = now()
from v218_sessions s
where e.program_session_id = s.id
  and s.block_name = 'Block 1 Build' and s.day_of_week = 1
  and e.deleted_at is null and e.exercise_name = 'Banded Knee Extension (90→45°)'
  and exists (
    select 1 from public.program_exercises x
    where x.program_session_id = s.id and x.deleted_at is null
      and x.exercise_name = 'Isometric Knee Extension (strap, crane)'
  );

select pg_temp.v218_slot('Block 1 Build', 1, 'Barbell Bench Press', 17, 'B', 1);
select pg_temp.v218_slot('Block 1 Build', 1, 'Tricep Pushdown', 21, 'B', 3);
select pg_temp.v218_slot('Block 1 Build', 1, 'Incline Dumbbell Press', 40, 'C', 3);

-- 3. Wednesday, Block 1 ----------------------------------------------------

select pg_temp.v218_slot('Block 1 Build', 3, 'Good Morning', 23, 'C', 1);
select pg_temp.v218_slot('Block 1 Build', 3, 'Face Pull', 31, 'C', 2);
select pg_temp.v218_slot('Block 1 Build', 3, 'Slider Hamstring Curl', 35, 'D', 1);
select pg_temp.v218_slot('Block 1 Build', 3, 'Dumbbell Curl', 36, 'D', 2);

update public.program_exercises e
set notes = concat_ws(' ', nullif(e.notes, ''), 'Go single-leg once 12 bilateral reps are RIR 3+.'),
    updated_at = now()
from v218_sessions s
where e.program_session_id = s.id
  and s.block_name = 'Block 1 Build' and s.day_of_week = 3
  and e.deleted_at is null and e.exercise_name = 'Slider Hamstring Curl'
  and position('Go single-leg once 12 bilateral reps' in coalesce(e.notes, '')) = 0;

-- 4. Friday, Block 1 (existing rows) ---------------------------------------

select pg_temp.v218_slot('Block 1 Build', 5, 'Heel-Elevated Goblet Squat (to 90°)', 30, 'B', 1);
select pg_temp.v218_slot('Block 1 Build', 5, 'Close-Grip Bench Press', 31, 'B', 2);
select pg_temp.v218_slot('Block 1 Build', 5, 'DB Single-Leg RDL', 40, 'C', 1);
select pg_temp.v218_slot('Block 1 Build', 5, 'Tricep Extension', 42, 'C', 2);
select pg_temp.v218_slot('Block 1 Build', 5, 'Hammer Curl', 43, 'C', 3);

-- 5. Block 2 ---------------------------------------------------------------

select pg_temp.v218_slot('Block 2 Strength', 1, 'Barbell Bench Press', 21, 'B', 1);
select pg_temp.v218_slot('Block 2 Strength', 1, 'Tricep Pushdown', 22, 'B', 2);
select pg_temp.v218_slot('Block 2 Strength', 1, 'Incline Dumbbell Press', 37, 'C', 3);
select pg_temp.v218_slot('Block 2 Strength', 1, 'Nordic Curl (eccentric, band-assisted)', 40, null, null);

select pg_temp.v218_slot('Block 2 Strength', 5, 'Close-Grip Bench Press', 31, 'B', 1);
select pg_temp.v218_slot('Block 2 Strength', 5, 'Tricep Extension', 41, 'C', 1);
select pg_temp.v218_slot('Block 2 Strength', 5, 'Nordic Curl (eccentric, band-assisted)', 42, 'C', 2);
select pg_temp.v218_slot('Block 2 Strength', 5, 'Hammer Curl', 43, 'C', 3);

-- 6. Settings --------------------------------------------------------------

update public.training_settings
set value = 0, updated_at = now()
where deleted_at is null and key = 'session_gait_drill_minutes' and value = 3;

update public.training_settings
set value = 0, updated_at = now()
where deleted_at is null and key = 'shoulder_emphasis' and value = 1;

insert into public.training_settings (user_id, key, value, label, unit, group_name, sort_order)
select t.user_id, 'leg_developer_step_lb', 2.5, 'Leg developer increase', 'lb', 'Progression', 55
from public.training_settings t
where t.key = 'cuff_step_lb' and t.deleted_at is null
  and not exists (
    select 1 from public.training_settings x
    where x.user_id = t.user_id and x.key = 'leg_developer_step_lb' and x.deleted_at is null
  );

-- 7. Daily ROM check -------------------------------------------------------

update public.supplements
set name = 'ROM check 7 min (prone hang, heel slides, prone heel-to-butt stretch 2 min)',
    updated_at = now()
where deleted_at is null and kind = 'habit'
  and name = 'ROM check 5 min (prone hang, heel slides)';

-- 8. Treadmill Zone 2 template ---------------------------------------------

insert into public.training_templates (user_id, name, template_type, definition)
select t.user_id, 'Treadmill incline walk Z2', 'cardio',
  jsonb_build_object(
    'sessionKind', 'zone2',
    'equipment', 'Treadmill',
    'notes', 'Treadmill incline walk 8-12%, hold 120-130 bpm. Counts toward weekly Zone 2 minutes. Hands off the rails.'
  )
from (
  select distinct user_id from public.training_templates
  where template_type = 'cardio' and deleted_at is null
) t
where not exists (
  select 1 from public.training_templates x
  where x.user_id = t.user_id and x.deleted_at is null
    and x.name = 'Treadmill incline walk Z2'
);

drop function pg_temp.v218_slot(text, int, text, int, text, int);
drop view v218_sessions;
