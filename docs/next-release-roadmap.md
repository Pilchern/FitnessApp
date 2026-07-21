# Recommended Next Release

Muscle-group/movement-pattern volume tracking and 4 new coaching-insight rules shipped 2026-07-21 (see `CURRENT_STATE.md`). Nutrition logging and settings (timezone/units/profile goals) shipped earlier; a second and third provider adapter (Peloton, Apple Health) already exist in code. Updated as of 2026-07-21.

## Highest-value next steps

1. Configure Withings OAuth credentials end to end (register app, wire env vars, verify a real sync).
2. Reactivate the Strava app registration (currently deactivated on Strava's side) and enable Peloton's native "auto-export to Strava" setting — Peloton-direct sync is confirmed blocked by Peloton's own API as of 2026-07-16 and isn't fixable from this codebase.
3. Wire `duration_seconds`/`distance_meters` on strength sets to the UI so timed sets (planks) and distance-based movements (carries) can be logged (TD-020) — `is_warmup` had the identical dead-column problem and was fixed 2026-07-21, same pattern applies.
4. Cross-provider duplicate detection + source-priority rules for cardio/body metrics — today only same-provider re-imports are deduplicated; connecting two overlapping providers (e.g. Peloton direct + Strava relay, or Withings + an Apple Health bridge) can double-count (TD-019).
5. DB-backed login/signup rate limiting — no application-level throttling exists today beyond whatever Supabase Auth enforces (TD-018).
6. Goal/training-plan entities with real numeric targets (target weight, target date, weekly split assigned to specific days) — today `profiles` only has 3 boolean goal flags and there's no scheduled-workout concept.
7. Add browser e2e tests for strength, recovery, nutrition, journal, insights, and settings (integration connect/sync flow coverage already shipped).
8. Add import-center retry tooling and richer sync diagnostics.
9. Account deletion / full data export flow (TD-022).

## Hardening follow-ups

1. Normalize server-action error mapping across all modules.
2. Add small shared composition helpers in `apps/web/src/lib/server` to reduce repeated repository wiring.
3. A user-editable exercise catalog or per-user alias overrides, once uncategorized strength volume becomes a recurring nuisance (today's catalog is static and in-code, TD-021).
