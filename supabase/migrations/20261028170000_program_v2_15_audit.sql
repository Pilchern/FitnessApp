-- Program v2.15 (owner request 2026-10-28, from the full health and training audit).
-- Statements 1-6 were APPLIED to live 2026-10-28 through the Supabase MCP before
-- this file existed; this file records them and is safe to rerun. Statement 7
-- (two settings rows) is new with the engine change in this PR.
--
-- 1. Arm isolation trimmed, blocks 10-36 (deloads borrow these sessions):
--    Tricep Pushdown 4 -> 2 sets; Tricep Extension, Dumbbell Curl, Hammer Curl
--    4 -> 3 sets. Partly reverses v2.10's 8 direct sets each (time budget;
--    triceps also get bench, incline and close-grip).
-- 2. Dead Hang 2 x max (30 s target, +5 s a week) on every Wednesday lift,
--    blocks 10-36. Grip/hang was the largest Outlive-standard gap (25 s vs 120 s).
-- 3. Zone 2: Tuesday 45 min, Saturday 60 min; HR band 125-132, cap 135, anchored
--    to pre-injury Zone 2 rides at 125-128 bpm; monthly drift check.
-- 4. Thursday rides: log HR 60 s after the last interval.
-- 5. Optional Sunday 30-min Zone 2 ride in each block 10-36.
-- 6. Program rules text and version string.
-- 7. Settings: leg barbell fast step (+10 lb below 135 lb).

with blk as (
  select b.id from public.program_blocks b
  join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
  where b.deleted_at is null and b.sessions_from_block_id is null and b.start_week between 10 and 36
)
update public.program_exercises e
set sets_min = case when e.exercise_name = 'Tricep Pushdown' then 2 else 3 end,
    sets_max = case when e.exercise_name = 'Tricep Pushdown' then 2 else 3 end
from public.program_sessions s
where s.id = e.program_session_id and s.deleted_at is null and e.deleted_at is null
  and s.block_id in (select id from blk)
  and e.exercise_name in ('Tricep Pushdown', 'Tricep Extension', 'Dumbbell Curl', 'Hammer Curl')
  and e.sets_max <> case when e.exercise_name = 'Tricep Pushdown' then 2 else 3 end;

with blk as (
  select b.id from public.program_blocks b
  join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
  where b.deleted_at is null and b.sessions_from_block_id is null and b.start_week between 10 and 36
),
tgt as (
  select s.id as sid, s.user_id,
    (select max(x.exercise_order) from public.program_exercises x where x.program_session_id = s.id) as mo
  from public.program_sessions s
  where s.deleted_at is null and s.day_of_week = 3 and s.session_type = 'lift'
    and s.block_id in (select id from blk)
    and not exists (select 1 from public.program_exercises x
                    where x.program_session_id = s.id and x.exercise_name = 'Dead Hang' and x.deleted_at is null)
)
insert into public.program_exercises (user_id, program_session_id, exercise_order, exercise_name, block_part,
  primary_muscle, readiness_requirement, measure, side_mode, load_kind, sets_min, sets_max, seconds_target,
  notes, category, counts_as_quad_set, cue, left_extra_sets)
select user_id, sid, mo + 1, 'Dead Hang', 'upper', null, 'any', 'time', 'bilateral', 'bodyweight', 2, 2, 30,
  'Max hold, stop about 5 s before grip fails. Log seconds. Aim +5 s a week; Outlive target 120 s. Step down onto the bench with the right leg.',
  'accessory', false, 'Active shoulders, full grip, no kipping.', 0
from tgt;

with blk as (
  select b.id from public.program_blocks b
  join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
  where b.deleted_at is null and b.sessions_from_block_id is null and b.start_week between 10 and 36
)
update public.program_sessions s
set minutes_min = case s.day_of_week when 2 then 45 else 60 end,
    minutes_max = case s.day_of_week when 2 then 45 else 60 end,
    structure = case s.day_of_week
      when 2 then 'Zone 2: 125 to 132 bpm, cap 135 (anchored to pre-injury Zone 2 rides at 125 to 128 bpm). Seated, cadence 85 to 90. Hold watts; add 5 W when HR at those watts falls 5+ bpm for 2 weeks. Monthly drift check: if second-half HR runs >5% above first half at the same watts, lower the cap to 130.'
      else 'Zone 2: 125 to 132 bpm, cap 135. Protected session. Seated, cadence 85 to 90.' end
where s.deleted_at is null and s.ride_kind = 'zone2' and s.day_of_week in (2, 6)
  and s.block_id in (select id from blk);

with blk as (
  select b.id from public.program_blocks b
  join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
  where b.deleted_at is null and b.sessions_from_block_id is null and b.start_week between 10 and 36
)
update public.program_sessions s
set structure = s.structure || ' Log HR 60 s after the last interval (heart-rate recovery).'
where s.deleted_at is null and s.day_of_week = 4 and s.session_type = 'peloton'
  and s.structure not ilike '%heart-rate recovery%' and s.block_id in (select id from blk);

with blk as (
  select b.id from public.program_blocks b
  join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
  where b.deleted_at is null and b.sessions_from_block_id is null and b.start_week between 10 and 36
)
insert into public.program_sessions (user_id, block_id, day_of_week, sort_order, session_type, name, ride_kind,
  minutes_min, minutes_max, structure, is_optional)
select s.user_id, s.block_id, 0, 2, 'peloton', 'Peloton Zone 2 (easy, optional)', 'zone2', 30, 30,
  'After the Sunday knee test. 125 to 132 bpm, cap 135. Skip if walk-jog ran today, or swap for a 40-min walk.', true
from public.program_sessions s
where s.deleted_at is null and s.ride_kind = 'zone2' and s.day_of_week = 6 and s.block_id in (select id from blk)
  and not exists (select 1 from public.program_sessions x
                  where x.block_id = s.block_id and x.day_of_week = 0 and x.session_type = 'peloton' and x.deleted_at is null);

update public.training_settings
set text_value = replace(replace(text_value,
      'Knee circuit (hip abductors, adductors, balance, soleus) 2x a week, any time of day.',
      'Core 2x a week, any time of day (dead bug, Pallof, side plank; suitcase carry from week 14).'),
      'Zone 2: 150 min a week.',
      'Zone 2: 150 min a week at 125 to 132 bpm, cap 135.')
    || E'\nLeg barbell lifts under 135 lb: +10 lb per session while the knee check is normal and every set hits RIR 2 or better.\nRIR is honest reps left with clean form. Never log a default.'
where key = 'program_rules' and deleted_at is null and text_value not like '%Never log a default.%';

update public.training_programs set version = 'program v2.15, 2026-10-28'
where is_active and deleted_at is null and version <> 'program v2.15, 2026-10-28';

-- 7. Settings ---------------------------------------------------------------------
with o as (select distinct user_id as uid from public.training_settings)
insert into public.training_settings
  (user_id, key, value, text_value, label, unit, group_name, sort_order)
select o.uid, t.key, t.value, null, t.label, t.unit, 'Progression', t.sort_order
from o
cross join (values
    ('leg_barbell_fast_step_lb', 10, 'Leg barbell increase below the ceiling (0 = off)', 'lb', 11),
    ('leg_barbell_fast_step_until_lb', 135, 'Leg barbell fast-step ceiling', 'lb', 12)
) as t(key, value, label, unit, sort_order)
on conflict (user_id, key) do nothing;
