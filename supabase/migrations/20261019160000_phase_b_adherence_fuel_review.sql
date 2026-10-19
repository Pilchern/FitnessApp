-- Phase B: adherence, fuel, sleep, body and the Sunday review.
--
-- Additive only: nullable columns on nutrition_logs, one new table for the
-- weekly manual entries, and new settings rows. Plain statements (the
-- Supabase MCP connector times out on DO blocks); safe to rerun.

-- Fast daily fuel entry on the existing nutrition log ------------------------
alter table public.nutrition_logs
  add column if not exists protein_grams smallint,
  add column if not exists calories integer,
  add column if not exists creatine_taken boolean,
  add column if not exists protein_50_by_9am boolean;

alter table public.nutrition_logs
  drop constraint if exists nutrition_logs_protein_grams_check,
  add constraint nutrition_logs_protein_grams_check
    check (protein_grams is null or protein_grams between 0 and 500);

alter table public.nutrition_logs
  drop constraint if exists nutrition_logs_calories_check,
  add constraint nutrition_logs_calories_check
    check (calories is null or calories between 0 and 10000);

-- Weekly manual entries for the Sunday review --------------------------------
-- One row per week (week_start = the Monday). Quad LSI comes from the PT
-- Tracker and walking asymmetry from Apple Health, typed in by hand.
create table if not exists public.program_weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  pt_visits_scheduled smallint check (pt_visits_scheduled between 0 and 14),
  pt_visits_attended smallint check (pt_visits_attended between 0 and 14),
  quad_lsi_pct numeric(5, 1) check (quad_lsi_pct between 0 and 200),
  walking_asymmetry_pct numeric(5, 1) check (walking_asymmetry_pct between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint program_weekly_checkins_user_week_key unique (user_id, week_start),
  constraint program_weekly_checkins_attended_le_scheduled
    check (pt_visits_attended is null or pt_visits_scheduled is null
      or pt_visits_attended <= pt_visits_scheduled)
);

drop trigger if exists set_program_weekly_checkins_updated_at on public.program_weekly_checkins;
create trigger set_program_weekly_checkins_updated_at before update on public.program_weekly_checkins for each row execute function public.set_updated_at();
grant select, insert, update on public.program_weekly_checkins to authenticated;
alter table public.program_weekly_checkins enable row level security;
drop policy if exists "program_weekly_checkins_select_own" on public.program_weekly_checkins;
create policy "program_weekly_checkins_select_own" on public.program_weekly_checkins for select to authenticated using (public.owns_row(user_id));
drop policy if exists "program_weekly_checkins_insert_own" on public.program_weekly_checkins;
create policy "program_weekly_checkins_insert_own" on public.program_weekly_checkins for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "program_weekly_checkins_update_own" on public.program_weekly_checkins;
create policy "program_weekly_checkins_update_own" on public.program_weekly_checkins for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

-- Phase B targets and thresholds (edit in Settings) --------------------------
with o as (select user_id as uid from public.profiles order by created_at limit 1)
insert into public.training_settings
  (user_id, key, value, text_value, label, unit, group_name, sort_order)
select o.uid, t.key, t.value, t.text_value, t.label, t.unit, t.group_name, t.sort_order
from o
cross join (values
    ('lifts_per_week', 3, null, 'Leg sessions per week', 'sessions', 'Adherence', 10),
    ('rides_per_week', 3, null, 'Peloton rides per week', 'rides', 'Adherence', 20),
    ('rom_days_per_week', 7, null, 'ROM check days per week', 'days', 'Adherence', 30),
    ('pt_visits_per_week', 2, null, 'PT visits scheduled per week', 'visits', 'Adherence', 40),
    ('execution_banner_weeks', 2, null, 'Weeks short on leg sessions before the banner', 'weeks', 'Adherence', 50),
    ('calendar_lift_time', null, '18:00', 'Calendar: lift start', null, 'Calendar', 10),
    ('calendar_lift_minutes', 80, null, 'Calendar: lift length', 'min', 'Calendar', 20),
    ('calendar_peloton_time', null, '18:00', 'Calendar: Peloton start', null, 'Calendar', 30),
    ('calendar_peloton_minutes', 45, null, 'Calendar: Peloton length', 'min', 'Calendar', 40),
    ('calendar_test_time', null, '09:00', 'Calendar: Sunday test start', null, 'Calendar', 50),
    ('calendar_test_minutes', 30, null, 'Calendar: Sunday test length', 'min', 'Calendar', 60),
    ('calories_lift_day_min', 2400, null, 'Calories on lift days, low end', 'kcal', 'Nutrition', 10),
    ('calories_lift_day_max', 2500, null, 'Calories on lift days, high end', 'kcal', 'Nutrition', 20),
    ('calories_rest_day', 2200, null, 'Calories on other days', 'kcal', 'Nutrition', 30),
    ('protein_flag_below_g', 160, null, 'Flag weeks whose protein average is under', 'g', 'Nutrition', 40),
    ('sleep_flag_below_h', 7, null, 'Flag weeks whose sleep average is under', 'h', 'Sleep and body', 10),
    ('weight_rise_lb_per_week', 0.5, null, 'Surplus banner: 7-day average rising faster than', 'lb/wk', 'Sleep and body', 20),
    ('weight_rise_weeks', 2, null, 'Surplus banner: weeks in a row', 'weeks', 'Sleep and body', 30),
    ('waist_every_days', 30, null, 'Waist at the navel every', 'days', 'Sleep and body', 40),
    ('lsi_target_1', 70, null, 'Quad LSI target line 1', '%', 'Review', 10),
    ('lsi_target_2', 80, null, 'Quad LSI target line 2', '%', 'Review', 20),
    ('lsi_target_3', 90, null, 'Quad LSI target line 3', '%', 'Review', 30),
    ('walking_asymmetry_target_pct', 5, null, 'Walking asymmetry target', '%', 'Review', 40)
) as t(key, value, text_value, label, unit, group_name, sort_order)
on conflict (user_id, key) do nothing;
