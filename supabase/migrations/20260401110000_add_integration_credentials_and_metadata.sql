alter table public.integration_connections
  add column if not exists capabilities text[] not null default '{}',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists last_failed_at timestamptz,
  add column if not exists last_failure_code text,
  add column if not exists last_failure_message text;

create table public.integration_connection_credentials (
  id uuid primary key default gen_random_uuid(),
  integration_connection_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  token_type text,
  scope text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_connection_id),
  unique (id, user_id),
  constraint integration_connection_credentials_connection_fk
    foreign key (integration_connection_id, user_id)
    references public.integration_connections (id, user_id)
    on delete cascade
);

create index integration_connections_provider_status_idx
  on public.integration_connections (provider, status, updated_at desc)
  where deleted_at is null;

create index integration_connection_credentials_user_provider_idx
  on public.integration_connection_credentials (user_id, provider);

create trigger set_integration_connection_credentials_updated_at
before update on public.integration_connection_credentials
for each row
execute function public.set_updated_at();
