-- Drop profiles.baseline_schedule (TD-040, 2026-10-20).
--
-- Ordering: apply AFTER the code that stops writing it is deployed. Until then the
-- profile bootstrap still sends baseline_schedule on a first-login upsert,
-- and that insert would fail against a table without the column.
--
-- The column held a pre-injury weekly plan that nothing read. The program
-- (program_* tables) is the single source for the weekly schedule and the
-- Zone 2 target, with training_templates as the fallback for a week no
-- program covers. No view, function or policy references the column.
-- Safe to rerun.

alter table public.profiles
  drop column if exists baseline_schedule;
