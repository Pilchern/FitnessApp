-- Program v2 engine (Phase A, 2026-10-20): supersets, Tue/Thu accessory
-- sessions, the session time budget, the new-block load multiplier, and the
-- targets the v2 brief changed.
--
-- Additive only: two nullable columns, one widened check, new settings rows.
-- The few value updates only touch rows still at their v1 default, so an
-- owner edit is never overwritten. No row is deleted. Plain statements (the
-- Supabase connector times out on DO blocks); safe to rerun.

-- Supersets: A1/A2 share a letter and alternate; rest comes after the pair.
alter table public.program_exercises
  add column if not exists superset_group text,
  add column if not exists superset_order smallint;

alter table public.program_exercises
  drop constraint if exists program_exercises_superset_check,
  add constraint program_exercises_superset_check
    check ((superset_group is null and superset_order is null)
        or (superset_group ~ '^[A-Z]$' and superset_order between 1 and 9));

-- Tue/Thu accessory block before the ride.
alter table public.program_sessions
  drop constraint if exists program_sessions_session_type_check,
  add constraint program_sessions_session_type_check
    check (session_type in
      ('lift', 'peloton', 'run', 'test', 'rest', 'walk_jog', 'walk', 'golf', 'accessory'));

-- New settings (edit in Settings) ------------------------------------------
with o as (select user_id as uid from public.profiles order by created_at limit 1)
insert into public.training_settings
  (user_id, key, value, text_value, label, unit, group_name, sort_order)
select o.uid, t.key, t.value, t.text_value, t.label, t.unit, t.group_name, t.sort_order
from o
cross join (values
    ('session_warm_up_minutes', 5::numeric, null::text, 'Warm-up', 'min', 'Session time budget', 10::smallint),
    ('session_gait_drill_minutes', 3, null, 'Gait drill', 'min', 'Session time budget', 20),
    ('session_transition_minutes', 4, null, 'Transitions', 'min', 'Session time budget', 30),
    ('set_work_seconds', 40, null, 'Work per set (when not timed)', 's', 'Session time budget', 40),
    ('rest_main_seconds', 150, null, 'Rest: main lifts', 's', 'Session time budget', 50),
    ('rest_pair_seconds', 90, null, 'Rest: after a superset pair', 's', 'Session time budget', 60),
    ('rest_accessory_seconds', 60, null, 'Rest: accessories', 's', 'Session time budget', 70),
    ('rest_plyo_seconds', 60, null, 'Rest: plyos', 's', 'Session time budget', 80),
    ('lift_session_max_minutes', 60, null, 'Flag lift sessions over', 'min', 'Session time budget', 90),
    ('new_block_load_multiplier', 1.1, null, 'New block: load x per step down in reps', 'x', 'Progression', 140),
    ('shoulder_emphasis', 0, null, 'Shoulder emphasis (1 = add Wednesday lateral raise)', null, 'Program', 30)
) as t(key, value, text_value, label, unit, group_name, sort_order)
on conflict (user_id, key) do nothing;

-- v2 targets, only where the v1 default is still in place --------------------
update public.training_settings set value = 60
  where key = 'calendar_lift_minutes' and value = 80 and deleted_at is null;

update public.training_settings set value = 8
  where key = 'walking_asymmetry_target_pct' and value = 5 and deleted_at is null;

update public.training_settings
  set text_value = 'Peloton easy 3 min; band TKE 15/leg; bodyweight box squat x10; glute bridge x10',
      label = 'Lift-day warm-up (5 min)'
  where key = 'warm_up' and deleted_at is null
    and text_value = 'Peloton easy 5 min; band TKE 15/leg; box squat bodyweight x10; glute bridge x10; leg swings 10/side';

update public.training_settings
  set text_value = 'Order: readiness check, warm-up, gait drill, plyos/power, main pairs, accessories.
Supersets: alternate A1 and A2, rest after the pair. Per-leg work: left then right, no rest between.
Lift days: 55-60 min, at most 4 upper-body movements.
Main lifts never to failure. Accessories may go to RIR 1.
Double progression: every set at the top of the range at the target RIR or better, then +5 lb barbell / next DB / +2.5 lb cuff / +5 s holds. Otherwise repeat.
Per-leg lifts: left first; its reps set the target; the right matches at the same load. Progress off the left only.
No load increase unless the knee check is normal, outside deloads, and 3-night sleep is 6.5 h or more.
Deload: one set off everything, no load increases, plyo volume halved.
New block: last block''s top working load x 1.1 per step down in reps (suggested, editable).
Hard quad sets: 12-16 a week.
Zone 2: 150 min a week. 8,000 steps and the 5-min ROM check (prone hang, heel slides) daily.
Pull-ups: at 30 total reps across sets, add load (belt or DB between the feet).
No conventional deadlifts. No kneeling on the left knee (half-kneel on the right only).
Pull-ups: step down onto the bench with the right leg, never drop off the bar, until the plyo_single gate is on.'
  where key = 'program_rules' and deleted_at is null
    and text_value like 'Order: readiness check, warm-up, power/plyo, main leg lift,%';

-- Walk-jog now moves one whole stage per session; the step sizes are unused.
update public.training_settings
  set label = label || ' (unused: one stage per session)'
  where key in ('walk_jog_step_min', 'walk_jog_step_max', 'walk_jog_start_run_min',
                'walk_jog_start_walk_min', 'walk_jog_start_rounds')
    and deleted_at is null and label not like '%(unused%';

-- Earliest single-leg plyo date per the v2 brief (display only).
update public.program_gates set earliest_on = '2026-11-09'
  where gate_key = 'plyo_single' and earliest_on is null and deleted_at is null;
