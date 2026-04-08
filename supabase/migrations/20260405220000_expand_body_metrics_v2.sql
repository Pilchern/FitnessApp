alter table public.body_metrics
  add column if not exists bone_mass_kg numeric(5, 3),
  add column if not exists bone_mass_lb numeric(6, 3),
  add column if not exists fat_free_mass_kg numeric(6, 2),
  add column if not exists fat_free_mass_lb numeric(6, 2),
  add column if not exists hydration_pct numeric(5, 2),
  add column if not exists visceral_fat_index integer;
