-- Add 'webhook' to the allowed trigger_type values for sync_job_runs.
-- The application layer already uses this value for Apple Health webhook syncs
-- but the check constraint was missing it.

ALTER TABLE sync_job_runs
  DROP CONSTRAINT sync_job_runs_trigger_type_check;

ALTER TABLE sync_job_runs
  ADD CONSTRAINT sync_job_runs_trigger_type_check
  CHECK (trigger_type IN ('scheduled', 'manual', 'retry', 'system', 'webhook'));
