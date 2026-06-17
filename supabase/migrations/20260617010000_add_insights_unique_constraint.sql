-- Required for upsert deduplication in the AI insights engine.
-- Ensures one persisted insight per (user, type, date) combination.
alter table public.insights
  add constraint insights_user_type_date_unique
  unique (user_id, insight_type, insight_date);
