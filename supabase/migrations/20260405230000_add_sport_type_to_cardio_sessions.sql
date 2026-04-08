alter table public.cardio_sessions
  add column if not exists sport_type text;
