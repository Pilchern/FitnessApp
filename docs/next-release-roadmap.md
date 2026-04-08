# Recommended Next Release

## Highest-value next steps

1. Build nutrition logging and replace the placeholder route.
2. Expand settings so timezone, units, and profile goals are editable.
3. Add browser e2e tests for auth, cardio, recovery, body, strength, and weekly review.
4. Add import-center retry tooling and richer sync diagnostics.
5. Add a second provider adapter to prove the integration framework is reusable.

## Hardening follow-ups

1. Normalize server-action error mapping across all modules.
2. Add small shared composition helpers in `apps/web/src/lib/server` to reduce repeated repository wiring.
3. Add background job execution infrastructure if scheduled syncs become a release requirement.
