alter table public.journal_entries
  add column if not exists related_week_start date,
  add column if not exists related_cardio_session_id uuid,
  add column if not exists related_strength_session_id uuid;

alter table public.journal_entries
  drop constraint if exists journal_entries_related_cardio_session_fk,
  add constraint journal_entries_related_cardio_session_fk
    foreign key (related_cardio_session_id, user_id)
    references public.cardio_sessions (id, user_id);

alter table public.journal_entries
  drop constraint if exists journal_entries_related_strength_session_fk,
  add constraint journal_entries_related_strength_session_fk
    foreign key (related_strength_session_id, user_id)
    references public.strength_sessions (id, user_id);

create index if not exists journal_entries_user_related_week_start_idx
  on public.journal_entries (user_id, related_week_start desc)
  where deleted_at is null;

create index if not exists journal_entries_related_cardio_session_idx
  on public.journal_entries (related_cardio_session_id)
  where deleted_at is null;

create index if not exists journal_entries_related_strength_session_idx
  on public.journal_entries (related_strength_session_id)
  where deleted_at is null;
