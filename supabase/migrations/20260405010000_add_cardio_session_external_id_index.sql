-- Index to support efficient deduplication lookups for imported cardio sessions.
-- A partial unique index on (user_id, source_provider, source_external_id)
-- where both provider and external ID are present ensures Peloton rides
-- (and any future cardio providers) cannot be double-imported.

create unique index cardio_sessions_external_id_dedup_idx
  on public.cardio_sessions (user_id, source_provider, source_external_id)
  where source_type = 'imported'
    and source_provider is not null
    and source_external_id is not null;
