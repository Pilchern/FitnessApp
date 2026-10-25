-- 1. Ride make-ups. Rides arrive from Apple Health with their real date, so a
--    missed Peloton ride made up on a later day needs a record saying which
--    session that day's ride stands in for. A lift make-up does not: the lift
--    is saved linked to the session it replaces (strength_sessions
--    .program_session_id).
--    One live make-up per session occurrence (session + scheduled date).
--
-- 2. Test days move to the PT Tracker (owner request 2026-10-25): the
--    program's "Test day + walk" sessions are soft-deleted, so they no longer
--    show, count or export to the calendar, and the two test-day calendar
--    settings with them. Reversible: clear deleted_at.
--
-- Additive table plus soft deletes. Plain statements; safe to rerun.

create table if not exists public.program_makeups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_session_id uuid not null,
  scheduled_date date not null,
  made_up_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint program_makeups_after_scheduled check (made_up_on > scheduled_date),
  constraint program_makeups_session_fk
    foreign key (program_session_id, user_id)
    references public.program_sessions (id, user_id)
    on delete cascade
);

create unique index if not exists program_makeups_occurrence_key
  on public.program_makeups (user_id, program_session_id, scheduled_date)
  where deleted_at is null;

create index if not exists program_makeups_user_made_up_on_idx
  on public.program_makeups (user_id, made_up_on)
  where deleted_at is null;

drop trigger if exists set_program_makeups_updated_at on public.program_makeups;
create trigger set_program_makeups_updated_at before update on public.program_makeups for each row execute function public.set_updated_at();

-- RLS like every other table; no grant to anon/authenticated (service role only).
alter table public.program_makeups enable row level security;
drop policy if exists "program_makeups_select_own" on public.program_makeups;
create policy "program_makeups_select_own" on public.program_makeups for select to authenticated using (public.owns_row(user_id));
drop policy if exists "program_makeups_insert_own" on public.program_makeups;
create policy "program_makeups_insert_own" on public.program_makeups for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "program_makeups_update_own" on public.program_makeups;
create policy "program_makeups_update_own" on public.program_makeups for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

-- 2. Test days off the program.
update public.program_sessions s
set deleted_at = now()
from public.program_blocks b
join public.training_programs p on p.id = b.program_id and p.is_active and p.deleted_at is null
where s.block_id = b.id
  and s.session_type = 'test'
  and s.deleted_at is null;

update public.training_settings
set deleted_at = now()
where key in ('calendar_test_time', 'calendar_test_minutes')
  and deleted_at is null;
