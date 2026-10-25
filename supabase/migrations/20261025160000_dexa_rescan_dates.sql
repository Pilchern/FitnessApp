-- Planned DEXA rescans, shown as a countdown on the dashboard and /body/dexa.
-- Comma-separated ISO dates, edited in Settings (Body composition). After the
-- last listed date the app counts 6 months on from the newest scan.
-- Additive: one settings row, on conflict do nothing. Safe to rerun.

with o as (select user_id as uid from public.profiles order by created_at limit 1)
insert into public.training_settings
  (user_id, key, value, text_value, label, unit, group_name, sort_order)
select o.uid, 'dexa_next_dates', null, '2027-01-16, 2027-04-16',
  'Planned DEXA scans (YYYY-MM-DD, comma-separated)', null, 'Body composition', 110
from o
on conflict (user_id, key) do nothing;
