-- Clears the Supabase security advisor WARNs (backlog B-11):
--   0026 pg_graphql_anon_table_exposed
--   0027 pg_graphql_authenticated_table_exposed
--   0011 function_search_path_mutable (public.set_updated_at, public.owns_row)
--
-- 1. Table grants. pg_graphql introspection (/graphql/v1) shows every relation
--    the calling role can SELECT, whatever RLS says, so anon and authenticated
--    could read the name and columns of all public tables. The lints check
--    only relation SELECT privileges while pg_graphql is installed, so revoking
--    usage on schema graphql, or execute on graphql.resolve, would not clear
--    them.
--    Safe because the app never reads as anon or authenticated: every request,
--    webhook and cron uses the service-role client
--    (apps/web/src/lib/server/supabase.ts), and the browser client in
--    apps/web/src/lib/client/supabase.ts has no callers. service_role and
--    postgres (pg_cron) keep their grants. RLS stays on and the policies stay
--    in place; with no grant behind them they simply never apply.
-- To undo: grant all on all tables in schema public to anon, authenticated;
-- alter default privileges in schema public grant all on tables to anon, authenticated;
-- alter function public.set_updated_at() reset search_path; alter function public.owns_row(uuid) reset search_path;
revoke all on all tables in schema public from anon, authenticated;

-- Stops tables created later by the role that runs migrations picking up the
-- Supabase default grants to these roles. A migration that grants to
-- authenticated explicitly will still reopen 0027 for that table.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 2. Pin search_path. Both bodies only call schema-qualified or pg_catalog
--    objects (now(), auth.uid()), so an empty search_path changes nothing.
--    owns_row is no longer inlined into RLS policies, which only matters for
--    authenticated queries, and there are none (see 1).
--    seed_staging.run is left alone: it is not defined by any migration. The
--    program seed generators create it in a throwaway seed_staging schema that
--    is meant to be dropped after each seed (docs/known-issues.md), and the
--    next seed would recreate it unpinned. Dropping that schema clears its
--    warning.
alter function public.set_updated_at() set search_path = '';
alter function public.owns_row(uuid) set search_path = '';

-- Safe to re-run: revoke, alter default privileges and alter function ... set
-- are all idempotent.
