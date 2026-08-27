-- TD-030: NutritionTargetService computes BMR via Mifflin-St Jeor, but profiles
-- has no age, height, or biological-sex columns, so the formula always
-- substituted DEFAULT_HEIGHT_CM = 170, DEFAULT_AGE = 30, and an implicit male
-- +5 constant. Real personalization was limited to the latest logged body
-- weight and three boolean goal flags, behind a Settings button labeled
-- "Recompute from my stats".
--
-- All three columns are nullable with no default: a profile that hasn't filled
-- them in keeps exactly today's behavior (population defaults plus the existing
-- in-UI disclosure), and the estimate only becomes personalized for the fields
-- the user actually supplies.
--
-- birth_date rather than an age integer, so the age used in the formula stays
-- correct as time passes instead of silently drifting a year stale.
--
-- biological_sex is a text check constraint rather than a PG enum, matching
-- this schema's existing convention (units_system, source_type). "unspecified"
-- is a real, storable choice so a user can decline without the app falling back
-- to a male constant on their behalf -- it is treated the same as NULL by the
-- calculation, which then discloses that it used a population average.

alter table public.profiles
  add column if not exists height_cm numeric(5, 1),
  add column if not exists birth_date date,
  add column if not exists biological_sex text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_biological_sex_check'
  ) then
    alter table public.profiles
      add constraint profiles_biological_sex_check
      check (biological_sex is null or biological_sex in ('male', 'female', 'unspecified'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_height_cm_check'
  ) then
    alter table public.profiles
      add constraint profiles_height_cm_check
      check (height_cm is null or (height_cm > 0 and height_cm <= 300));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_date_check'
  ) then
    alter table public.profiles
      add constraint profiles_birth_date_check
      check (birth_date is null or (birth_date > date '1900-01-01' and birth_date <= current_date));
  end if;
end $$;
