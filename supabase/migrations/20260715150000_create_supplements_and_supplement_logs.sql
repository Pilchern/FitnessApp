-- Supplement adherence tracking: a user-defined, open-ended list of
-- supplements (creatine, vitamin D, omega-3, magnesium, glycine, etc.) plus
-- a daily taken/not-taken log per supplement. Two normalized tables rather
-- than a jsonb blob so adherence can be queried/aggregated directly (e.g.
-- "adherence % for creatine over the last 30 days") and so a user can
-- retire a supplement without losing its historical log rows.

create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  constraint supplements_name_not_blank check (length(trim(name)) > 0)
);

create table if not exists public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  supplement_id uuid not null,
  log_date date not null,
  taken boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint supplement_logs_supplement_fk
    foreign key (supplement_id, user_id)
    references public.supplements (id, user_id)
    on delete cascade,
  -- Plain (non-partial) unique constraint so the repository can upsert on
  -- conflict (see 20260617010000_add_insights_unique_constraint.sql for the
  -- same pattern) — a `where deleted_at is null` partial index would not be
  -- usable as an ON CONFLICT target via supabase-js's onConflict option.
  -- Adherence logs are upserted, never soft-deleted individually, so this
  -- doesn't collide with the soft-delete convention in practice.
  constraint supplement_logs_supplement_date_unique unique (supplement_id, log_date)
);

create trigger set_supplements_updated_at
before update on public.supplements
for each row
execute function public.set_updated_at();

create trigger set_supplement_logs_updated_at
before update on public.supplement_logs
for each row
execute function public.set_updated_at();

create index if not exists supplements_user_idx
  on public.supplements (user_id)
  where deleted_at is null;

create index if not exists supplements_user_active_idx
  on public.supplements (user_id, is_active)
  where deleted_at is null;

create index if not exists supplement_logs_user_date_idx
  on public.supplement_logs (user_id, log_date desc)
  where deleted_at is null;

create index if not exists supplement_logs_supplement_idx
  on public.supplement_logs (supplement_id)
  where deleted_at is null;

grant select, insert, update on public.supplements to authenticated;
grant select, insert, update on public.supplement_logs to authenticated;

alter table public.supplements enable row level security;
alter table public.supplement_logs enable row level security;

create policy "supplements_select_own"
  on public.supplements
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "supplements_insert_own"
  on public.supplements
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "supplements_update_own"
  on public.supplements
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "supplement_logs_select_own"
  on public.supplement_logs
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "supplement_logs_insert_own"
  on public.supplement_logs
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "supplement_logs_update_own"
  on public.supplement_logs
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));
