create index training_templates_user_type_idx
  on public.training_templates (user_id, template_type)
  where deleted_at is null;

create index training_templates_user_archived_idx
  on public.training_templates (user_id, is_archived)
  where deleted_at is null;

create unique index integration_connections_user_provider_unique_idx
  on public.integration_connections (user_id, provider)
  where deleted_at is null;

create index integration_connections_user_status_idx
  on public.integration_connections (user_id, status)
  where deleted_at is null;

create index integration_connections_provider_user_idx
  on public.integration_connections (provider, provider_user_id)
  where deleted_at is null;

create index import_batches_user_created_at_idx
  on public.import_batches (user_id, created_at desc);

create index import_batches_connection_created_at_idx
  on public.import_batches (integration_connection_id, created_at desc);

create index import_batches_provider_status_idx
  on public.import_batches (provider, status, created_at desc);

create index raw_import_events_batch_created_at_idx
  on public.raw_import_events (import_batch_id, created_at);

create index raw_import_events_user_provider_created_at_idx
  on public.raw_import_events (user_id, provider, created_at desc);

create index raw_import_events_mapping_status_idx
  on public.raw_import_events (mapping_status, created_at);

create index raw_import_events_canonical_target_idx
  on public.raw_import_events (canonical_target_table, canonical_target_id);

create unique index raw_import_events_provider_dedupe_idx
  on public.raw_import_events (user_id, provider, provider_external_id, payload_hash)
  where provider_external_id is not null;

create index sync_job_runs_user_created_at_idx
  on public.sync_job_runs (user_id, created_at desc);

create index sync_job_runs_connection_created_at_idx
  on public.sync_job_runs (integration_connection_id, created_at desc);

create index sync_job_runs_status_scheduled_idx
  on public.sync_job_runs (status, scheduled_for);

create unique index sync_job_runs_active_dedupe_idx
  on public.sync_job_runs (job_type, dedupe_key)
  where dedupe_key is not null and status in ('queued', 'running');

create index cardio_sessions_user_session_date_idx
  on public.cardio_sessions (user_id, session_date desc)
  where deleted_at is null;

create index cardio_sessions_user_kind_session_date_idx
  on public.cardio_sessions (user_id, session_kind, session_date desc)
  where deleted_at is null;

create index cardio_sessions_import_batch_idx
  on public.cardio_sessions (import_batch_id);

create index cardio_sessions_raw_import_event_idx
  on public.cardio_sessions (raw_import_event_id);

create unique index cardio_sessions_provider_external_unique_idx
  on public.cardio_sessions (user_id, source_provider, source_external_id)
  where source_external_id is not null and deleted_at is null;

create index strength_sessions_user_session_date_idx
  on public.strength_sessions (user_id, session_date desc)
  where deleted_at is null;

create index strength_sessions_template_idx
  on public.strength_sessions (training_template_id)
  where deleted_at is null;

create index strength_sessions_import_batch_idx
  on public.strength_sessions (import_batch_id);

create unique index strength_sessions_provider_external_unique_idx
  on public.strength_sessions (user_id, source_provider, source_external_id)
  where source_external_id is not null and deleted_at is null;

create index strength_exercise_sets_session_order_idx
  on public.strength_exercise_sets (user_id, strength_session_id, exercise_order, set_order)
  where deleted_at is null;

create index strength_exercise_sets_exercise_name_idx
  on public.strength_exercise_sets (user_id, exercise_name)
  where deleted_at is null;

create unique index recovery_checkins_user_date_unique_idx
  on public.recovery_checkins (user_id, checkin_date)
  where deleted_at is null;

create index recovery_checkins_user_date_idx
  on public.recovery_checkins (user_id, checkin_date desc)
  where deleted_at is null;

create unique index recovery_checkins_provider_external_unique_idx
  on public.recovery_checkins (user_id, source_provider, source_external_id)
  where source_external_id is not null and deleted_at is null;

create index body_metrics_user_measured_on_idx
  on public.body_metrics (user_id, measured_on desc)
  where deleted_at is null;

create index body_metrics_user_week_idx
  on public.body_metrics (user_id, date_trunc('week', measured_on::timestamp))
  where deleted_at is null;

create unique index body_metrics_provider_external_unique_idx
  on public.body_metrics (user_id, source_provider, source_external_id)
  where source_external_id is not null and deleted_at is null;

create unique index nutrition_logs_user_log_date_unique_idx
  on public.nutrition_logs (user_id, log_date)
  where deleted_at is null;

create index nutrition_logs_user_log_date_idx
  on public.nutrition_logs (user_id, log_date desc)
  where deleted_at is null;

create unique index weekly_reviews_user_week_start_unique_idx
  on public.weekly_reviews (user_id, week_start)
  where deleted_at is null;

create index weekly_reviews_user_status_week_idx
  on public.weekly_reviews (user_id, status, week_start desc)
  where deleted_at is null;

create index journal_entries_user_entry_date_idx
  on public.journal_entries (user_id, entry_date desc)
  where deleted_at is null;

create index journal_entries_tags_gin_idx
  on public.journal_entries
  using gin (tags);

create index journal_entries_search_gin_idx
  on public.journal_entries
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || body))
  where deleted_at is null;

create index insights_user_date_idx
  on public.insights (user_id, insight_date desc)
  where deleted_at is null;

create index insights_user_status_date_idx
  on public.insights (user_id, status, insight_date desc)
  where deleted_at is null;

create index insights_user_type_date_idx
  on public.insights (user_id, insight_type, insight_date desc)
  where deleted_at is null;
