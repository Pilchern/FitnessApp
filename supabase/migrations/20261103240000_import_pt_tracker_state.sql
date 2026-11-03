-- PT Tracker absorb, phase 3 (owner request 2026-11-03): one-time import of
-- the newest pt_tracker_state snapshot's data that knee_tests does not hold.
--
-- The tracker's sync already mirrors tests, ROM, girth, effusion, daily pain
-- and weekly walking into knee_tests as source 'pt_tracker'. Not mirrored,
-- and imported here as source 'pt_tracker_import' (never 'pt_tracker': the
-- tracker's push soft-deletes pt_tracker rows it did not send):
--   healthdaily  -> walking_asymmetry_daily %, walking_speed_daily m/s, steps_daily
--   kneecap      -> kneecap_pain (1 = yes, 0 = no)
--   daytype 'pt' -> clinic_visit (counts as a PT visit in the weekly review)
--   clinic note  -> clinic_visit notes
--   swelling     -> swelling_nightly (1 = yes, 0 = no), pre-v5 nightly answer
--   kneefeel     -> knee_feel (1-10), pre-v5 nightly rating
--   completions  -> hep_completions (check-offs per day)
-- Daily walking keeps its own types so a single noisy day never stands in
-- for the weekly reading the gates use.
--
-- Dedupe on (test_date, test_type, side, rep_index) against every source,
-- then on conflict do nothing: re-running inserts nothing. pt_tracker_state
-- is not changed.

with snap as (
  select s.user_id, s.snapshot -> 'keys' as k
  from public.pt_tracker_state s
  where s.deleted_at is null
  order by s.created_at desc
  limit 1
),
health as (
  select snap.user_id, e.key::date as d, e.value as v
  from snap, jsonb_each(coalesce((snap.k ->> 'knee-rehab-healthdaily-v1')::jsonb, '{}'::jsonb)) e
  where e.key ~ '^\d{4}-\d{2}-\d{2}$' and jsonb_typeof(e.value) = 'object'
),
clinic as (
  select snap.user_id, e.key::date as d, nullif(left(e.value ->> 'note', 400), '') as note
  from snap, jsonb_each(coalesce((snap.k ->> 'knee-rehab-clinic-v1')::jsonb, '{}'::jsonb)) e
  where e.key ~ '^\d{4}-\d{2}-\d{2}$'
),
pt_days as (
  select snap.user_id, e.key::date as d
  from snap, jsonb_each_text(coalesce((snap.k ->> 'knee-rehab-daytype-v1')::jsonb, '{}'::jsonb)) e
  where e.key ~ '^\d{4}-\d{2}-\d{2}$' and e.value = 'pt'
),
rows (user_id, test_date, test_type, side, value, unit, notes) as (
  select user_id, d, 'walking_asymmetry_daily', null::text, (v ->> 'asym')::numeric, '%',
    case when v ? 'asymN' then 'samples: ' || (v ->> 'asymN') end
  from health where jsonb_typeof(v -> 'asym') = 'number'
  union all
  select user_id, d, 'walking_speed_daily', null, (v ->> 'speed')::numeric, 'm/s', null
  from health where jsonb_typeof(v -> 'speed') = 'number'
  union all
  select user_id, d, 'steps_daily', null, (v ->> 'steps')::numeric, 'steps', null
  from health where jsonb_typeof(v -> 'steps') = 'number'
  union all
  select snap.user_id, e.key::date, 'kneecap_pain', null, case e.value when 'yes' then 1 else 0 end, 'yes/no', null
  from snap, jsonb_each_text(coalesce((snap.k ->> 'knee-rehab-kneecap-v1')::jsonb, '{}'::jsonb)) e
  where e.key ~ '^\d{4}-\d{2}-\d{2}$' and e.value in ('yes', 'no')
  union all
  select snap.user_id, e.key::date, 'swelling_nightly', null, case e.value when 'yes' then 1 else 0 end, 'yes/no', null
  from snap, jsonb_each_text(coalesce((snap.k ->> 'knee-rehab-swelling-v1')::jsonb, '{}'::jsonb)) e
  where e.key ~ '^\d{4}-\d{2}-\d{2}$' and e.value in ('yes', 'no')
  union all
  select snap.user_id, e.key::date, 'knee_feel', null, (e.value #>> '{}')::numeric, '1-10', null
  from snap, jsonb_each(coalesce((snap.k ->> 'knee-rehab-kneefeel-v1')::jsonb, '{}'::jsonb)) e
  where e.key ~ '^\d{4}-\d{2}-\d{2}$' and jsonb_typeof(e.value) = 'number'
  union all
  select coalesce(p.user_id, c.user_id), coalesce(p.d, c.d), 'clinic_visit', null, 1, 'visit',
    concat_ws('; ', case when p.d is not null then 'PT day (PT Tracker)' end, c.note)
  from pt_days p full join clinic c on c.d = p.d and c.user_id = p.user_id
  union all
  select snap.user_id, (c ->> 'date')::date, 'hep_completions', null, count(*)::numeric, 'items', null
  from snap, jsonb_array_elements(coalesce((snap.k ->> 'knee-rehab-completions-v1')::jsonb, '[]'::jsonb)) c
  where (c ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'
  group by snap.user_id, (c ->> 'date')::date
)
insert into public.knee_tests as k (user_id, test_date, test_type, side, value, unit, rep_index, source, notes)
select r.user_id, r.test_date, r.test_type, r.side, round(r.value, 3), r.unit, 1, 'pt_tracker_import', nullif(r.notes, '')
from rows r
where r.value is not null
  and not exists (
    select 1 from public.knee_tests x
    where x.user_id = r.user_id and x.test_date = r.test_date and x.test_type = r.test_type
      and x.side is not distinct from r.side and x.rep_index = 1 and x.deleted_at is null
  )
on conflict on constraint knee_tests_natural_key do nothing;
