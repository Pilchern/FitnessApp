grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.training_templates to authenticated;
grant select, insert, update on public.cardio_sessions to authenticated;
grant select, insert, update on public.strength_sessions to authenticated;
grant select, insert, update on public.strength_exercise_sets to authenticated;
grant select, insert, update on public.recovery_checkins to authenticated;
grant select, insert, update on public.body_metrics to authenticated;
grant select, insert, update on public.nutrition_logs to authenticated;
grant select, insert, update on public.weekly_reviews to authenticated;
grant select, insert, update on public.journal_entries to authenticated;
grant select on public.insights to authenticated;
grant select on public.integration_connections to authenticated;
grant select on public.sync_job_runs to authenticated;
grant select on public.import_batches to authenticated;
grant select on public.raw_import_events to authenticated;

alter table public.profiles enable row level security;
alter table public.training_templates enable row level security;
alter table public.cardio_sessions enable row level security;
alter table public.strength_sessions enable row level security;
alter table public.strength_exercise_sets enable row level security;
alter table public.recovery_checkins enable row level security;
alter table public.body_metrics enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.journal_entries enable row level security;
alter table public.insights enable row level security;
alter table public.integration_connections enable row level security;
alter table public.sync_job_runs enable row level security;
alter table public.import_batches enable row level security;
alter table public.raw_import_events enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "training_templates_select_own"
  on public.training_templates
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "training_templates_insert_own"
  on public.training_templates
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "training_templates_update_own"
  on public.training_templates
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "cardio_sessions_select_own"
  on public.cardio_sessions
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "cardio_sessions_insert_own"
  on public.cardio_sessions
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "cardio_sessions_update_own"
  on public.cardio_sessions
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "strength_sessions_select_own"
  on public.strength_sessions
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "strength_sessions_insert_own"
  on public.strength_sessions
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "strength_sessions_update_own"
  on public.strength_sessions
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "strength_exercise_sets_select_own"
  on public.strength_exercise_sets
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "strength_exercise_sets_insert_own"
  on public.strength_exercise_sets
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "strength_exercise_sets_update_own"
  on public.strength_exercise_sets
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "recovery_checkins_select_own"
  on public.recovery_checkins
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "recovery_checkins_insert_own"
  on public.recovery_checkins
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "recovery_checkins_update_own"
  on public.recovery_checkins
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "body_metrics_select_own"
  on public.body_metrics
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "body_metrics_insert_own"
  on public.body_metrics
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "body_metrics_update_own"
  on public.body_metrics
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "nutrition_logs_select_own"
  on public.nutrition_logs
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "nutrition_logs_insert_own"
  on public.nutrition_logs
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "nutrition_logs_update_own"
  on public.nutrition_logs
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "weekly_reviews_select_own"
  on public.weekly_reviews
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "weekly_reviews_insert_own"
  on public.weekly_reviews
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "weekly_reviews_update_own"
  on public.weekly_reviews
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "journal_entries_select_own"
  on public.journal_entries
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "journal_entries_insert_own"
  on public.journal_entries
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "journal_entries_update_own"
  on public.journal_entries
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));

create policy "insights_select_own"
  on public.insights
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "integration_connections_select_own"
  on public.integration_connections
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "sync_job_runs_select_own"
  on public.sync_job_runs
  for select
  to authenticated
  using (user_id is not null and public.owns_row(user_id));

create policy "import_batches_select_own"
  on public.import_batches
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "raw_import_events_select_own"
  on public.raw_import_events
  for select
  to authenticated
  using (public.owns_row(user_id));
