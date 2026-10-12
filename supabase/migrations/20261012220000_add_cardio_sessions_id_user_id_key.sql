-- cardio_sessions never had the (id, user_id) unique key the other user-owned
-- tables carry, so 20260401090000_expand_journal_entries_v1's composite
-- foreign key to it could not be created and that migration never reached
-- live. id is the primary key, so the pair is already unique; this only makes
-- it a referenceable key. Applied to live 2026-10-12, before the journal
-- migration. A fresh replay still hits the journal migration first; apply this
-- one ahead of it there.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cardio_sessions'::regclass
      and conname = 'cardio_sessions_id_user_id_key'
  ) then
    alter table public.cardio_sessions
      add constraint cardio_sessions_id_user_id_key unique (id, user_id);
  end if;
end $$;
