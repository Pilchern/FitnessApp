-- Nutrition macros and the post-DEXA targets (2,450 kcal, 200 g protein,
-- 255 g net carbs, 70 g fat, 38 g fiber).
--
-- 1. nutrition_logs gets net carbs, fat and fiber in grams (nullable, the
--    same shape as protein_grams), for manual entry now and the Cronometer
--    daily-summary import later.
-- 2. kcal, protein and fiber targets stay where they already live (profiles);
--    net carbs and fat are new training_settings rows (Nutrition group).
-- 3. calories_rest_day goes from 2200 to 2450 so the weekly review's calorie
--    target matches the flat 2,450 plan (lift days 2400-2500 already average
--    2450). Changes an existing value; the old one is noted here to undo:
--    update public.training_settings set value = 2200 where key = 'calories_rest_day';
--
-- Plain statements (the Supabase MCP connector times out on DO blocks); safe
-- to rerun.

alter table public.nutrition_logs
  add column if not exists net_carbs_grams smallint,
  add column if not exists fat_grams smallint,
  add column if not exists fiber_grams smallint;

alter table public.nutrition_logs
  drop constraint if exists nutrition_logs_macro_grams_check,
  add constraint nutrition_logs_macro_grams_check
    check ((net_carbs_grams is null or net_carbs_grams between 0 and 1500)
       and (fat_grams is null or fat_grams between 0 and 1000)
       and (fiber_grams is null or fiber_grams between 0 and 300));

update public.profiles
set daily_calories_target = 2450,
    daily_protein_grams_target = 200,
    daily_fiber_grams_target = 38
where user_id = (select user_id from public.profiles order by created_at limit 1);

with o as (select user_id as uid from public.profiles order by created_at limit 1)
insert into public.training_settings
  (user_id, key, value, text_value, label, unit, group_name, sort_order)
select o.uid, t.key, t.value, t.text_value, t.label, t.unit, t.group_name, t.sort_order
from o
cross join (values
    ('net_carbs_target_g', 255, null, 'Net carbs per day', 'g', 'Nutrition', 50),
    ('fat_target_g', 70, null, 'Fat per day', 'g', 'Nutrition', 60)
) as t(key, value, text_value, label, unit, group_name, sort_order)
on conflict (user_id, key) do nothing;

update public.training_settings
set value = 2450
where key = 'calories_rest_day' and value = 2200;
