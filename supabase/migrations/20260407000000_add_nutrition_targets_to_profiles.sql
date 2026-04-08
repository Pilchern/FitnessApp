alter table public.profiles
  add column if not exists daily_protein_grams_target integer,
  add column if not exists daily_calories_target integer,
  add column if not exists daily_fiber_grams_target integer;
