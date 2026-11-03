-- Per-set timestamps (owner request 2026-11-03): when each set was ticked off
-- in the logger, so a session shows real rest between sets and its working
-- minutes against lift_session_max_minutes.
--
-- Nullable: sets logged before this column, sets from a Watch merge and sets
-- saved without a tick (free logging) have no time. Additive and idempotent.

alter table public.strength_exercise_sets
  add column if not exists completed_at timestamptz;
