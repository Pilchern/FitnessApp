-- Body composition targets after the 2026-10-24 DEXA, edited in Settings
-- ("Body composition" group) and read through ProgramSettings.
--
-- The quad strength LSI gate (90%, return to sport, Oct 2027) is not
-- duplicated: it is the existing lsi_target_3 row.
--
-- Additive only: inserts settings rows, on conflict do nothing. Safe to rerun.

with o as (select user_id as uid from public.profiles order by created_at limit 1)
insert into public.training_settings
  (user_id, key, value, text_value, label, unit, group_name, sort_order)
select o.uid, t.key, t.value, t.text_value, t.label, t.unit, t.group_name, t.sort_order
from o
cross join (values
    ('almi_target_jan27', 8.25, null, 'ALMI target, Jan 2027 scan', 'kg/m²', 'Body composition', 10),
    ('almi_target_oct27', 8.7, null, 'ALMI target, Oct 2027', 'kg/m²', 'Body composition', 20),
    ('almi_target_2029', 9.5, null, 'ALMI target, 2029', 'kg/m²', 'Body composition', 30),
    ('leg_lean_lsi_target_jan27', 94, null, 'Leg lean LSI target, Jan 2027 scan', '%', 'Body composition', 40),
    ('leg_lean_lsi_target_oct27', 97, null, 'Leg lean LSI target, Oct 2027', '%', 'Body composition', 50),
    ('dexa_bf_target_jan27', 21.5, null, 'DEXA body fat target, Jan 2027 scan', '%', 'Body composition', 60),
    ('dexa_bf_target_oct27', 17.5, null, 'DEXA body fat target, Oct 2027', '%', 'Body composition', 70),
    ('dexa_bf_target_2029', 15, null, 'DEXA body fat target, 2029', '%', 'Body composition', 80),
    ('waist_target_in', 34.5, null, 'Waist at the navel, at or under', 'in', 'Body composition', 90),
    ('vat_max_lb', 0.25, null, 'DEXA VAT, hold under', 'lb', 'Body composition', 100)
) as t(key, value, text_value, label, unit, group_name, sort_order)
on conflict (user_id, key) do nothing;
