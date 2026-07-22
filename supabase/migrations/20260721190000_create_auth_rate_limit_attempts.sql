-- Login/signup rate limiting (TD-018). Tracks individual auth attempts so
-- loginAction/signupAction can enforce a rolling-window lockout instead of
-- relying entirely on whatever Supabase Auth enforces server-side (not
-- configurable or visible from this codebase).
--
-- No user_id: an attacker probing a nonexistent or someone else's email must
-- still be rate-limited, so this can't be scoped to auth.users the way every
-- other table in this app is. Identifier is the normalized (trimmed,
-- lowercased) email supplied to the attempt, not a verified account.
--
-- This table is written and read only by the server-side admin client
-- (pre-authentication rate limiting has no user session to scope RLS to),
-- so RLS is enabled with no policies — the same "enabled, service-role
-- bypass only" pattern used for integration_connection_credentials.
create table public.auth_rate_limit_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  action text not null check (action in ('login', 'signup')),
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index auth_rate_limit_attempts_lookup_idx
  on public.auth_rate_limit_attempts (identifier, action, attempted_at desc);

alter table public.auth_rate_limit_attempts enable row level security;

comment on table public.auth_rate_limit_attempts is
  'Rolling-window login/signup attempt log for rate limiting (TD-018). No user_id — identifier is the raw normalized email, since attempts against nonexistent accounts must be limited too. Read/written only by the service-role client.';
