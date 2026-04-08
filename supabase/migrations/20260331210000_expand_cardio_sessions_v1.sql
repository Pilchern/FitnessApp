alter table public.cardio_sessions
  add column planned_vs_completed text not null default 'completed'
    check (planned_vs_completed in ('planned', 'completed', 'partial', 'skipped')),
  add column avg_output numeric(8, 2),
  add column cadence_min integer,
  add column cadence_max integer,
  add column resistance_min numeric(5, 2),
  add column resistance_max numeric(5, 2),
  add column interval_structure text,
  add column rpe numeric(3, 1);

alter table public.cardio_sessions
  add constraint cardio_sessions_cadence_bounds_check
    check (
      cadence_min is null
      or cadence_max is null
      or cadence_min <= cadence_max
    ),
  add constraint cardio_sessions_resistance_bounds_check
    check (
      resistance_min is null
      or resistance_max is null
      or resistance_min <= resistance_max
    ),
  add constraint cardio_sessions_rpe_check
    check (rpe is null or (rpe >= 1 and rpe <= 10));
