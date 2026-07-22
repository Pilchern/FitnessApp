-- User-editable exercise catalog overrides (TD-021). The muscle-group
-- catalog in packages/application/src/modules/strength/exercise-catalog-data.ts
-- is a static, in-code list — exercises outside it resolve to null and are
-- excluded from muscle-group/push-pull reporting (visibly, via
-- unclassifiedWorkingSetCount, never silently dropped). This table lets a
-- user teach the app a classification for an exercise name it doesn't
-- recognize, without a code change. Overrides are checked before the
-- built-in catalog at read time (see resolveExercise() in
-- exercise-catalog-data.ts), so a user's classification always wins over
-- the shipped default for names they've explicitly classified.
create table public.exercise_muscle_group_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_name text not null,
  normalized_name text not null,
  muscle_group text not null check (
    muscle_group in (
      'chest', 'back', 'shoulders', 'biceps', 'triceps',
      'quads', 'hamstrings', 'glutes', 'calves', 'core'
    )
  ),
  movement_pattern text not null check (movement_pattern in ('push', 'pull', 'legs', 'core')),
  category text not null check (category in ('compound', 'isolation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, normalized_name)
);

create index exercise_muscle_group_overrides_user_idx
  on public.exercise_muscle_group_overrides (user_id)
  where deleted_at is null;

create trigger set_exercise_muscle_group_overrides_updated_at
before update on public.exercise_muscle_group_overrides
for each row
execute function public.set_updated_at();

grant select, insert, update on public.exercise_muscle_group_overrides to authenticated;

alter table public.exercise_muscle_group_overrides enable row level security;

create policy "exercise_muscle_group_overrides_select_own"
  on public.exercise_muscle_group_overrides
  for select
  to authenticated
  using (public.owns_row(user_id));

create policy "exercise_muscle_group_overrides_insert_own"
  on public.exercise_muscle_group_overrides
  for insert
  to authenticated
  with check (public.owns_row(user_id));

create policy "exercise_muscle_group_overrides_update_own"
  on public.exercise_muscle_group_overrides
  for update
  to authenticated
  using (public.owns_row(user_id))
  with check (public.owns_row(user_id));
