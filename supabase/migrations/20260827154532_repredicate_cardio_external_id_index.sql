-- `cardio_sessions_external_id_dedup_idx` (added 2026-04-05) is a unique index
-- on (user_id, source_provider, source_external_id) predicated only on
-- source_type/source_provider/source_external_id being present — it has no
-- `deleted_at is null` clause, unlike its sibling
-- `cardio_sessions_provider_external_unique_idx` from the original index
-- migration, which covers the same tuple and does.
--
-- The missing predicate means a soft-deleted row keeps its slot in the index.
-- Every read path filters `deleted_at is null`, so once a row is archived —
-- by the user, or by cross-provider duplicate detection (TD-019) — the app no
-- longer sees it and a re-import of that same external id falls through to an
-- INSERT that then violates this constraint. For Apple Health, which re-posts
-- whatever the bridge app sends with no cursor, that failure repeats on every
-- push forever.
--
-- The application layer no longer depends on this being fixed
-- (CardioSessionService.upsertImported now checks for a tombstone explicitly),
-- but the index should still match its sibling so the two can't disagree.

drop index if exists public.cardio_sessions_external_id_dedup_idx;

create unique index if not exists cardio_sessions_external_id_dedup_idx
  on public.cardio_sessions (user_id, source_provider, source_external_id)
  where source_type = 'imported'
    and source_provider is not null
    and source_external_id is not null
    and deleted_at is null;
