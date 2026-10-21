-- PT Tracker sync: knee test data in this database, read by the Fitness App.
--
-- knee_tests: one row per measured value (a crane-scale trial, a hop, a tape
-- reading). Written only by public.pt_tracker_push from the tracker's
-- localStorage, which stays the source of truth: every push sends the full
-- set of pt_tracker rows, so re-syncing the same data changes nothing and a
-- value removed in the tracker is soft-deleted here.
--
-- pt_tracker_state: the tracker's full localStorage (knee-rehab-* keys, minus
-- photos and its own one-time backups) on every push that changed something.
-- The last 30 per user are kept as a ring: 30 slots, each push overwrites the
-- oldest, so nothing is ever deleted and the table stays bounded.
--
-- Access. The 20261020170300 security fixes revoked every table grant from
-- anon and authenticated, and the Fitness App reads with the service role.
-- The tracker is a static page signed in as the owner, so instead of
-- re-granting these tables it gets two security definer functions that only
-- ever act on auth.uid()'s rows: pt_tracker_pull (latest snapshot) and
-- pt_tracker_push (snapshot + knee_tests). No table grant is added, so the
-- graphql exposure lints (0026/0027) stay clear. RLS is on with the usual
-- owner policies, as on every other table, for if grants are ever restored.
--
-- Safe to re-run: create ... if not exists, create or replace, drop ... if
-- exists, on conflict do nothing.

create table if not exists public.knee_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  test_date date not null,
  -- quad_iso_90, ham_iso_90, single_leg_sit_to_stand, hop_single, ... (see
  -- the tracker's knee-test mapping, PTSync.TEST_TYPES).
  test_type text not null check (test_type ~ '^[a-z0-9_]{1,40}$'),
  -- L = operated (left), R = other; null for values that have no side.
  side text check (side in ('L', 'R')),
  value numeric(10, 3) not null,
  unit text not null check (char_length(unit) between 1 and 20),
  -- Trial number within the test (1-3 for crane and hop trials), else 1.
  rep_index smallint not null default 1 check (rep_index between 1 and 20),
  source text not null default 'pt_tracker' check (source ~ '^[a-z0-9_]{1,40}$'),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Natural key: one value per source, date, test, side and trial. side is
  -- nullable, so nulls must not be distinct for the upsert to be idempotent.
  constraint knee_tests_natural_key
    unique nulls not distinct (user_id, source, test_date, test_type, side, rep_index)
);

create index if not exists knee_tests_user_type_date_idx
  on public.knee_tests (user_id, test_type, test_date desc)
  where deleted_at is null;

drop trigger if exists set_knee_tests_updated_at on public.knee_tests;
create trigger set_knee_tests_updated_at before update on public.knee_tests
  for each row execute function public.set_updated_at();

alter table public.knee_tests enable row level security;
drop policy if exists "knee_tests_select_own" on public.knee_tests;
create policy "knee_tests_select_own" on public.knee_tests for select to authenticated using (public.owns_row(user_id));
drop policy if exists "knee_tests_insert_own" on public.knee_tests;
create policy "knee_tests_insert_own" on public.knee_tests for insert to authenticated with check (public.owns_row(user_id));
drop policy if exists "knee_tests_update_own" on public.knee_tests;
create policy "knee_tests_update_own" on public.knee_tests for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));

create table if not exists public.pt_tracker_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The tracker's knee-rehab-schema-v1 version (4 since v5).
  schema_version smallint not null check (schema_version between 0 and 100),
  -- { "keys": { "knee-rehab-...": "<raw localStorage string>", ... } }
  snapshot jsonb not null,
  key_count smallint not null default 0,
  -- Ring position 0-29; a push takes the next free slot, then the oldest.
  slot smallint not null default 0 check (slot between 0 and 29),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pt_tracker_state_user_slot_key unique (user_id, slot)
);

create index if not exists pt_tracker_state_user_created_idx
  on public.pt_tracker_state (user_id, created_at desc);

drop trigger if exists set_pt_tracker_state_updated_at on public.pt_tracker_state;
create trigger set_pt_tracker_state_updated_at before update on public.pt_tracker_state
  for each row execute function public.set_updated_at();

alter table public.pt_tracker_state enable row level security;
drop policy if exists "pt_tracker_state_select_own" on public.pt_tracker_state;
create policy "pt_tracker_state_select_own" on public.pt_tracker_state for select to authenticated using (public.owns_row(user_id));
drop policy if exists "pt_tracker_state_insert_own" on public.pt_tracker_state;
create policy "pt_tracker_state_insert_own" on public.pt_tracker_state for insert to authenticated with check (public.owns_row(user_id));

-- Latest snapshot for the signed-in user, or null.
create or replace function public.pt_tracker_pull()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select jsonb_build_object(
      'schema_version', s.schema_version,
      'snapshot', s.snapshot,
      'created_at', s.created_at)
    into result
  from public.pt_tracker_state s
  where s.user_id = uid and s.deleted_at is null
  order by s.created_at desc
  limit 1;
  return result;
end;
$$;

-- Saves the snapshot (unless identical to the latest) into the ring of 30,
-- and makes the user's pt_tracker knee_tests equal to p_tests: new rows
-- inserted, changed rows updated, rows not in p_tests soft-deleted, a row
-- that comes back un-deleted. Unchanged rows are not touched.
-- p_tests: [{test_date, test_type, side, value, unit, rep_index, notes}].
create or replace function public.pt_tracker_push(
  p_schema_version integer,
  p_snapshot jsonb,
  p_tests jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  latest jsonb;
  saved boolean := false;
  used integer;
  next_slot smallint;
  n_inserted integer := 0;
  n_updated integer := 0;
  n_deleted integer := 0;
  n_total integer := 0;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_snapshot) is distinct from 'object'
     or jsonb_typeof(p_snapshot -> 'keys') is distinct from 'object' then
    raise exception 'snapshot must be an object with keys' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tests) is distinct from 'array' then
    raise exception 'tests must be an array' using errcode = '22023';
  end if;
  if octet_length(p_snapshot::text) > 4000000 or jsonb_array_length(p_tests) > 20000 then
    raise exception 'payload too large' using errcode = '54000';
  end if;

  select s.snapshot into latest
  from public.pt_tracker_state s
  where s.user_id = uid and s.deleted_at is null
  order by s.created_at desc
  limit 1;

  if latest is distinct from p_snapshot then
    select count(*) into used from public.pt_tracker_state s where s.user_id = uid;
    if used < 30 then
      next_slot := used;
    else
      select s.slot into next_slot from public.pt_tracker_state s
      where s.user_id = uid order by s.created_at asc limit 1;
    end if;
    -- clock_timestamp, not now(): two pushes in one transaction still order.
    insert into public.pt_tracker_state as s
      (user_id, slot, schema_version, snapshot, key_count, created_at)
    values (uid, next_slot, p_schema_version, p_snapshot,
      (select count(*) from jsonb_object_keys(p_snapshot -> 'keys')), clock_timestamp())
    on conflict on constraint pt_tracker_state_user_slot_key do update
      set schema_version = excluded.schema_version, snapshot = excluded.snapshot,
          key_count = excluded.key_count, created_at = excluded.created_at, deleted_at = null;
    saved := true;
  end if;

  -- One statement, so the upsert and the soft delete see the same incoming
  -- set; they touch disjoint rows (in it / not in it).
  with incoming as (
    select distinct on (t.test_date, t.test_type, nullif(t.side, ''), coalesce(t.rep_index, 1))
      t.test_date, t.test_type, nullif(t.side, '') as side, t.value::numeric(10, 3) as value,
      t.unit, coalesce(t.rep_index, 1)::smallint as rep_index, nullif(left(t.notes, 500), '') as notes
    from jsonb_to_recordset(p_tests) as t(
      test_date date, test_type text, side text, value numeric,
      unit text, rep_index smallint, notes text)
    where t.test_date is not null and t.test_type is not null
      and t.value is not null and t.unit is not null
  ),
  up as (
    insert into public.knee_tests as k
      (user_id, test_date, test_type, side, value, unit, rep_index, source, notes)
    select uid, i.test_date, i.test_type, i.side, i.value, i.unit, i.rep_index, 'pt_tracker', i.notes
    from incoming i
    on conflict on constraint knee_tests_natural_key do update
      set value = excluded.value, unit = excluded.unit, notes = excluded.notes, deleted_at = null
      where (k.value, k.unit, k.notes, k.deleted_at)
        is distinct from (excluded.value, excluded.unit, excluded.notes, null::timestamptz)
    returning (xmax = 0) as inserted
  ),
  gone as (
    update public.knee_tests k
    set deleted_at = now()
    where k.user_id = uid
      and k.source = 'pt_tracker'
      and k.deleted_at is null
      and not exists (
        select 1 from incoming i
        where i.test_date = k.test_date
          and i.test_type = k.test_type
          and i.side is not distinct from k.side
          and i.rep_index = k.rep_index)
    returning 1
  )
  select (select count(*) from incoming),
         (select count(*) from up where inserted),
         (select count(*) from up where not inserted),
         (select count(*) from gone)
    into n_total, n_inserted, n_updated, n_deleted;

  return jsonb_build_object(
    'snapshot_saved', saved,
    'tests', n_total,
    'inserted', n_inserted,
    'updated', n_updated,
    'deleted', n_deleted);
end;
$$;

revoke all on function public.pt_tracker_pull() from public, anon;
revoke all on function public.pt_tracker_push(integer, jsonb, jsonb) from public, anon;
grant execute on function public.pt_tracker_pull() to authenticated;
grant execute on function public.pt_tracker_push(integer, jsonb, jsonb) to authenticated;

-- Progression settings (owner's rows; the owner is the training_settings user,
-- profiles is empty on live).
with o as (select distinct user_id as uid from public.training_settings)
insert into public.training_settings
  (user_id, key, value, text_value, label, unit, group_name, sort_order)
select o.uid, t.key, t.value, null, t.label, t.unit, 'Progression', t.sort_order
from o
cross join (values
    ('dumbbell_max_lb', 52.5, 'Heaviest dumbbell (suggested loads stop here)', 'lb', 45),
    ('quad_drop_hold_n', 65, 'Hold loads when the left quad crane test drops more than', 'N', 75)
) as t(key, value, label, unit, sort_order)
on conflict (user_id, key) do nothing;
