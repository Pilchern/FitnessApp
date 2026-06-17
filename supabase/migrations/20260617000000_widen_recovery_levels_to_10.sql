-- Widen recovery_checkins readiness/energy levels from 1-5 to 1-10 to match
-- form and application schemas (z.number().int().min(1).max(10)).

alter table recovery_checkins
  drop constraint if exists recovery_checkins_readiness_level_check;

alter table recovery_checkins
  drop constraint if exists recovery_checkins_energy_level_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recovery_checkins_readiness_level_check'
  ) then
    alter table recovery_checkins
      add constraint recovery_checkins_readiness_level_check
      check (readiness_level between 1 and 10);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'recovery_checkins_energy_level_check'
  ) then
    alter table recovery_checkins
      add constraint recovery_checkins_energy_level_check
      check (energy_level between 1 and 10);
  end if;
end
$$;
