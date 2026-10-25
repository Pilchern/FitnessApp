-- DEXA scans: one row per scan, typed in from the report.
--
-- Kept out of body_metrics on purpose: body_metrics is the Withings (BIA)
-- trend, and a DEXA reading mixed into it would hide the scan-vs-scale
-- offset. Derived numbers (ALMI, FFMI, limb LSI, the Withings offset) are
-- computed in code from these columns and never stored.
--
-- height_in is the height used for ALMI/FFMI (the profile's 183.0 cm rounds
-- 72 in up and moves ALMI by 0.01). Null falls back to the profile height.
--
-- Additive only. Plain statements (the Supabase MCP connector times out on DO
-- blocks); safe to rerun: create ... if not exists, drop ... if exists before
-- each create, on conflict do nothing.

create table if not exists public.dexa_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_date date not null,
  facility text check (char_length(facility) <= 120),
  machine text check (char_length(machine) <= 120),
  height_in numeric(4, 1) check (height_in is null or height_in between 48 and 96),
  -- Total body
  total_mass_lb numeric(6, 1) check (total_mass_lb is null or total_mass_lb between 50 and 600),
  fat_lb numeric(6, 1) check (fat_lb is null or fat_lb between 0 and 400),
  lean_lb numeric(6, 1) check (lean_lb is null or lean_lb between 0 and 400),
  bmc_lb numeric(5, 2) check (bmc_lb is null or bmc_lb between 0 and 30),
  body_fat_pct numeric(4, 1) check (body_fat_pct is null or body_fat_pct between 0 and 80),
  -- Regions (both sides together)
  arms_fat_lb numeric(5, 1) check (arms_fat_lb is null or arms_fat_lb between 0 and 100),
  arms_lean_lb numeric(5, 1) check (arms_lean_lb is null or arms_lean_lb between 0 and 100),
  arms_bmc_lb numeric(5, 2) check (arms_bmc_lb is null or arms_bmc_lb between 0 and 10),
  legs_fat_lb numeric(5, 1) check (legs_fat_lb is null or legs_fat_lb between 0 and 200),
  legs_lean_lb numeric(5, 1) check (legs_lean_lb is null or legs_lean_lb between 0 and 200),
  legs_bmc_lb numeric(5, 2) check (legs_bmc_lb is null or legs_bmc_lb between 0 and 20),
  trunk_fat_lb numeric(5, 1) check (trunk_fat_lb is null or trunk_fat_lb between 0 and 300),
  trunk_lean_lb numeric(5, 1) check (trunk_lean_lb is null or trunk_lean_lb between 0 and 300),
  trunk_bmc_lb numeric(5, 2) check (trunk_bmc_lb is null or trunk_bmc_lb between 0 and 20),
  android_fat_lb numeric(5, 1) check (android_fat_lb is null or android_fat_lb between 0 and 100),
  android_lean_lb numeric(5, 1) check (android_lean_lb is null or android_lean_lb between 0 and 100),
  android_bmc_lb numeric(5, 2) check (android_bmc_lb is null or android_bmc_lb between 0 and 10),
  gynoid_fat_lb numeric(5, 1) check (gynoid_fat_lb is null or gynoid_fat_lb between 0 and 100),
  gynoid_lean_lb numeric(5, 1) check (gynoid_lean_lb is null or gynoid_lean_lb between 0 and 100),
  gynoid_bmc_lb numeric(5, 2) check (gynoid_bmc_lb is null or gynoid_bmc_lb between 0 and 10),
  -- Sides (left = operated leg)
  right_arm_lean_lb numeric(5, 1) check (right_arm_lean_lb is null or right_arm_lean_lb between 0 and 60),
  right_arm_fat_lb numeric(5, 1) check (right_arm_fat_lb is null or right_arm_fat_lb between 0 and 60),
  left_arm_lean_lb numeric(5, 1) check (left_arm_lean_lb is null or left_arm_lean_lb between 0 and 60),
  left_arm_fat_lb numeric(5, 1) check (left_arm_fat_lb is null or left_arm_fat_lb between 0 and 60),
  right_leg_lean_lb numeric(5, 1) check (right_leg_lean_lb is null or right_leg_lean_lb between 0 and 100),
  right_leg_fat_lb numeric(5, 1) check (right_leg_fat_lb is null or right_leg_fat_lb between 0 and 100),
  left_leg_lean_lb numeric(5, 1) check (left_leg_lean_lb is null or left_leg_lean_lb between 0 and 100),
  left_leg_fat_lb numeric(5, 1) check (left_leg_fat_lb is null or left_leg_fat_lb between 0 and 100),
  -- Visceral fat, fat distribution, bone
  vat_lb numeric(5, 2) check (vat_lb is null or vat_lb between 0 and 20),
  vat_in3 numeric(7, 2) check (vat_in3 is null or vat_in3 between 0 and 20000),
  ag_ratio numeric(4, 2) check (ag_ratio is null or ag_ratio between 0 and 5),
  bmd_total numeric(5, 3) check (bmd_total is null or bmd_total between 0 and 3),
  bmd_t_score numeric(3, 1) check (bmd_t_score is null or bmd_t_score between -10 and 10),
  bmd_z_score numeric(3, 1) check (bmd_z_score is null or bmd_z_score between -10 and 10),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One live scan per date (the form upserts on it).
create unique index if not exists dexa_scans_user_scan_date_key
  on public.dexa_scans (user_id, scan_date)
  where deleted_at is null;

drop trigger if exists set_dexa_scans_updated_at on public.dexa_scans;
create trigger set_dexa_scans_updated_at before update on public.dexa_scans for each row execute function public.set_updated_at();

-- RLS like every other table. No grant to anon/authenticated: the app reads
-- with the service role (20261020170300_security_advisor_fixes.sql).
alter table public.dexa_scans enable row level security;
drop policy if exists "dexa_scans_select_own" on public.dexa_scans;
create policy "dexa_scans_select_own" on public.dexa_scans for select to authenticated using (public.owns_row(user_id));
drop policy if exists "dexa_scans_insert_own" on public.dexa_scans;
create policy "dexa_scans_insert_own" on public.dexa_scans for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "dexa_scans_update_own" on public.dexa_scans;
create policy "dexa_scans_update_own" on public.dexa_scans for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

-- Baseline scan, 2026-10-24, owner's report.
with o as (select user_id as uid from public.profiles order by created_at limit 1)
insert into public.dexa_scans (
  user_id, scan_date, facility, machine, height_in,
  total_mass_lb, fat_lb, lean_lb, bmc_lb, body_fat_pct,
  arms_fat_lb, arms_lean_lb, arms_bmc_lb,
  legs_fat_lb, legs_lean_lb, legs_bmc_lb,
  trunk_fat_lb, trunk_lean_lb, trunk_bmc_lb,
  android_fat_lb, android_lean_lb, android_bmc_lb,
  gynoid_fat_lb, gynoid_lean_lb, gynoid_bmc_lb,
  right_arm_lean_lb, right_arm_fat_lb, left_arm_lean_lb, left_arm_fat_lb,
  right_leg_lean_lb, right_leg_fat_lb, left_leg_lean_lb, left_leg_fat_lb,
  vat_lb, vat_in3, ag_ratio, bmd_total, bmd_t_score, bmd_z_score, notes
)
select o.uid, date '2026-10-24', 'Live Lean Rx, Libertyville', 'GE Lunar Prodigy', 72,
  184.6, 42.1, 135.2, 7.2, 22.8,
  4.1, 19.0, 1.0,
  17.0, 40.3, 2.6,
  18.8, 67.4, 2.1,
  2.3, 9.7, 0.1,
  7.9, 22.4, 0.7,
  9.8, 2.1, 9.3, 2.0,
  21.2, 8.2, 19.1, 8.8,
  0.09, 2.69, 0.73, 1.360, 1.6, 1.4,
  'Baseline, 10 weeks post left ACLR.'
from o
on conflict (user_id, scan_date) where deleted_at is null do nothing;
