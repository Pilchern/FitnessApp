alter table public.weekly_reviews
  add column if not exists best_win text,
  add column if not exists biggest_miss text,
  add column if not exists lesson text,
  add column if not exists next_week_priority text,
  add column if not exists confidence smallint check (confidence between 1 and 10),
  add column if not exists score_details jsonb not null default '{}'::jsonb,
  add column if not exists strategic_decision text,
  add column if not exists risk_forecast text,
  add column if not exists manual_overrides jsonb not null default '{}'::jsonb;

update public.weekly_reviews
set
  best_win = coalesce(best_win, wins),
  biggest_miss = coalesce(biggest_miss, adjustments),
  lesson = coalesce(lesson, reflection),
  next_week_priority = coalesce(next_week_priority, next_week_focus)
where
  best_win is null
  or biggest_miss is null
  or lesson is null
  or next_week_priority is null;
