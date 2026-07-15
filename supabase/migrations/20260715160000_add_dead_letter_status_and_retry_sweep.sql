-- TD-014: wire up sync_job_runs as a real retry queue.
--
-- 1. Adds 'dead_letter' as a valid sync_job_runs.status value — a run that
--    has exhausted MAX_RETRY_ATTEMPTS (see
--    packages/jobs/src/orchestration/retry-sweep.ts) lands here permanently
--    and is never retried again.
-- 2. Enables pg_cron + pg_net so Postgres itself can drive scheduling
--    (Supabase-native, no new vendor/billing relationship), calling the
--    EXISTING Vercel API routes over HTTP instead of porting the Node.js
--    orchestration logic into Deno/Edge Functions.
-- 3. Schedules two jobs:
--      - a 15-minute sweep hitting /api/cron/retry-failed-syncs (the actual
--        retry/backoff/dead-letter engine)
--      - a weekly Withings sync hitting /api/cron/withings-sync, matching
--        the existing Monday 8am UTC cadence used by vercel.json for
--        peloton-sync / strava-sync / weekly-review-auto-finalize
--
-- ============================================================================
-- MANUAL ONE-TIME SETUP REQUIRED (run once in the Supabase SQL editor, with
-- YOUR real values, BEFORE or AFTER applying this migration — the cron jobs
-- below are inert no-ops until these two secrets exist in Vault):
--
--   select vault.create_secret('<your CRON_SECRET value>', 'cron_bearer_secret');
--   select vault.create_secret('https://fitness-app-web-six.vercel.app', 'cron_target_base_url');
--
-- These values are deliberately NOT in this file — migration files are
-- committed to git, and a bearer secret / production URL must never be
-- committed in plaintext. public.trigger_cron_route() (below) reads both
-- from vault.decrypted_secrets BY NAME at call time, not at schedule-definition
-- time, so no secret material appears anywhere in this migration.
--
-- To rotate CRON_SECRET later: call
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'cron_bearer_secret'),
--     '<new value>'
--   );
-- (and update the Vercel env var CRON_SECRET to match).
-- ============================================================================

-- 1. Allow 'dead_letter' as a sync_job_runs status, following the exact
--    drop/re-add pattern used in 20260408000000_add_webhook_trigger_type.sql.
alter table sync_job_runs
  drop constraint if exists sync_job_runs_status_check;

alter table sync_job_runs
  add constraint sync_job_runs_status_check
  check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter'));

-- 2. Extensions needed for Postgres-native scheduling + outbound HTTP.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 3. Helper function: looks up the bearer secret + target base URL from
--    Vault AT CALL TIME (not at cron.schedule() definition time) and fires
--    an async POST at the given route via pg_net. security definer + a
--    pinned search_path so it can read `vault` and `net` regardless of the
--    caller's role (pg_cron runs jobs as the role that scheduled them).
create or replace function public.trigger_cron_route(route_path text)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_bearer_secret text;
  v_base_url text;
  v_request_id bigint;
begin
  select decrypted_secret into v_bearer_secret
  from vault.decrypted_secrets
  where name = 'cron_bearer_secret'
  limit 1;

  select decrypted_secret into v_base_url
  from vault.decrypted_secrets
  where name = 'cron_target_base_url'
  limit 1;

  if v_bearer_secret is null or v_base_url is null then
    raise warning
      'trigger_cron_route(%): missing vault secret(s) cron_bearer_secret / cron_target_base_url — run the one-time vault.create_secret(...) setup (see migration header comment). Skipping.',
      route_path;
    return;
  end if;

  select net.http_post(
    url := v_base_url || route_path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_bearer_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  ) into v_request_id;
end;
$$;

comment on function public.trigger_cron_route(text) is
  'Reads cron_bearer_secret / cron_target_base_url from Supabase Vault at call time and POSTs to <base_url><route_path> via pg_net. Used by pg_cron jobs (see cron.schedule calls in this migration) so no secret is ever embedded in scheduled SQL. Requires a one-time vault.create_secret(...) setup — see header comment.';

-- 4. Schedule the retry sweep every 15 minutes.
--    cron.schedule() unschedules any existing job with the same name first,
--    so this migration is safe to re-run.
select cron.schedule(
  'retry-failed-syncs-sweep',
  '*/15 * * * *',
  $$select public.trigger_cron_route('/api/cron/retry-failed-syncs');$$
);

-- 5. Schedule the Withings weekly sync, matching the Monday 8am UTC cadence
--    vercel.json already uses for peloton-sync / strava-sync /
--    weekly-review-auto-finalize.
select cron.schedule(
  'withings-weekly-sync',
  '0 8 * * 1',
  $$select public.trigger_cron_route('/api/cron/withings-sync');$$
);
