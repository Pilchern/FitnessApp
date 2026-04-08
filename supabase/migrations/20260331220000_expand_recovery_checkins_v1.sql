alter table public.recovery_checkins
  add column stress_level smallint,
  add column soreness_level smallint;

alter table public.recovery_checkins
  drop constraint if exists recovery_checkins_readiness_level_check,
  add constraint recovery_checkins_readiness_level_check
    check (readiness_level is null or readiness_level between 1 and 10),
  add constraint recovery_checkins_stress_level_check
    check (stress_level is null or stress_level between 1 and 10),
  add constraint recovery_checkins_soreness_level_check
    check (soreness_level is null or soreness_level between 1 and 10);
