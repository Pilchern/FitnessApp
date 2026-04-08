-- RLS policies for integration_connection_credentials
-- The service_role key (used by the jobs package and OAuth callback orchestrator) bypasses RLS.
-- These policies protect the authenticated (anon) client from cross-user access.

create policy "Users can read their own integration credentials"
  on public.integration_connection_credentials
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own integration credentials"
  on public.integration_connection_credentials
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own integration credentials"
  on public.integration_connection_credentials
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own integration credentials"
  on public.integration_connection_credentials
  for delete
  to authenticated
  using (user_id = auth.uid());
