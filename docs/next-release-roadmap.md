# Recommended Next Release

Nutrition logging and settings (timezone/units/profile goals) both shipped; a second and third provider adapter (Peloton, Apple Health) already exist in code. Updated as of 2026-07-15.

## Highest-value next steps

1. Configure Withings OAuth credentials end to end (register app, wire env vars, verify a real sync).
2. Decide Peloton-direct vs. Peloton→Strava-relay as the cardio sync path, then connect a real Peloton account.
3. Extend the Apple Health webhook beyond sleep (steps, VO2 max, resting HR, exercise minutes, active energy).
4. Add background job execution infrastructure with real retry/dead-letter handling — 4 cron routes exist today with no queue or retry (TD-014).
5. Add browser e2e tests for integration connect/sync flows, strength, recovery, nutrition, journal, insights, and settings.
6. Add import-center retry tooling and richer sync diagnostics.

## Hardening follow-ups

1. Normalize server-action error mapping across all modules.
2. Add small shared composition helpers in `apps/web/src/lib/server` to reduce repeated repository wiring.
3. Schedule `/api/cron/insights-generate` in `vercel.json` (currently unscheduled — TD-017).
