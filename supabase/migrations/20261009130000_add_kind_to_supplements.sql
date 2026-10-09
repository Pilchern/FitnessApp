-- Daily habits (Foundation Training, morning light, steps, mobility) reuse the
-- supplements tables: both are a user-defined list plus one taken/not-taken
-- log row per item per day, with the same RLS, soft-retire and upsert
-- behavior. A `kind` column separates the two lists in the UI instead of
-- duplicating two tables, a repository, a service and an adherence summary.
-- Existing rows default to 'supplement', so nothing changes for current data.

alter table public.supplements
  add column if not exists kind text not null default 'supplement'
  check (kind in ('supplement', 'habit'));
