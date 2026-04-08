alter table public.recovery_checkins
  add column if not exists time_in_bed_minutes integer,
  add column if not exists sleep_efficiency_pct numeric(5,2),
  add column if not exists deep_sleep_minutes integer,
  add column if not exists rem_sleep_minutes integer,
  add column if not exists core_sleep_minutes integer,
  add column if not exists awake_minutes integer,
  add column if not exists sleep_respiratory_rate numeric(5,2),
  add column if not exists sleep_spo2_avg_pct numeric(5,2),
  add column if not exists sleep_hrv_avg numeric(6,2),
  add column if not exists sleep_avg_heart_rate smallint;

alter table public.recovery_checkins
  add constraint recovery_checkins_sleep_efficiency_check
    check (sleep_efficiency_pct is null or (sleep_efficiency_pct >= 0 and sleep_efficiency_pct <= 100)),
  add constraint recovery_checkins_sleep_spo2_check
    check (sleep_spo2_avg_pct is null or (sleep_spo2_avg_pct >= 0 and sleep_spo2_avg_pct <= 100));
