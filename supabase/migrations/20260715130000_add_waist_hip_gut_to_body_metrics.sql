-- Additional waist measurement points alongside the existing navel-level
-- waist_in/waist_cm columns: hip-level and gut/umbilicus-level readings.
-- Same numeric precision as waist_in (numeric(5, 2)), inches only — these
-- are manual-entry-first measurements and do not (yet) have a metric
-- counterpart column, matching how waist_in shipped before waist_cm was
-- added alongside it.

alter table public.body_metrics
  add column if not exists waist_hip_in numeric(5, 2),
  add column if not exists waist_gut_in numeric(5, 2);
