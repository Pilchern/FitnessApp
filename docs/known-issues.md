# Known Issues

**Last verified against code:** 2026-08-26.

## Fixed 2026-08-26 (see CURRENT_STATE.md session log)

- Session cookies were readable from JavaScript (`httpOnly` unset); open redirect via a backslash-prefixed `redirectTo`; Strava/Peloton sync failures that recorded nothing and were never retried; Apple Health webhooks with no body-size or array-length bound; no security headers.
- `computeJournalStreak` skipped a day at positive UTC offsets; the Saturday-missed rule fired on an in-progress Saturday; the missing-weekly-review nudge fired on empty accounts; three dashboard goal-progress miscalculations (VO2 boundary double-count, fat-loss pace divided by a fixed 4 weeks, UTC `today` in a user-local streak).
- The Apple Health sleep sync rewrote a valid 1440-minute value as 24 minutes.
- `/api/account/export` silently truncated at 500 rows per table.

## Current weak spots

- Playwright E2E covers auth, navigation, body, cardio, integrations connect flow, and weekly-review (6 specs); the remaining modules (strength, recovery, nutrition, journal, insights, settings) have no browser coverage yet.
- E2E does not run in CI — Playwright's `webServer` needs a live Supabase project, and CI has no credentials for one. The GitHub Actions workflow (`.github/workflows/ci.yml`) runs format, typecheck, lint, unit tests, and the production build only.
- OAuth callback and sync behavior are covered by unit tests, not live-provider integration tests.
- Withings and Apple Health are live and verified. Strava's app registration is deactivated on Strava's side and its API now requires a paid subscription the user has declined; Peloton's unofficial auth endpoint returns `403` for any credentials as of 2026-07-16 and is not fixable from this codebase. Apple Health is the only active cardio-import path today.
- Integration credentials are intentionally server-only and require correct service-role usage in deployment.
- Nutrition calorie/protein targets still substitute population-average age, height, and an implicit male BMR constant, because `profiles` has no age/height/sex columns (TD-030). A 1200 kcal/day safety floor and an in-UI disclosure of exactly what the estimate does and doesn't account for are in place, so the number is not presented as personalized — but it isn't personalized either.

## Resolved since this file was last accurate

The 2026-07-15 audit corrected this file once; it drifted again. These were listed as open here but had already shipped:

- **TD-018** — application-level login/signup rate limiting (DB-backed rolling window). Shipped.
- **TD-020** — `duration_seconds`/`distance_meters` on strength sets wired through to the UI. Shipped.
- **TD-021** — user-editable exercise catalog overrides and per-user aliases. Shipped.
- **TD-022** — account deletion and full data export ("Danger zone" in Settings). Shipped.
- **TD-019** — cross-provider duplicate detection. Shipped 2026-08-26: imported cardio sessions and body metrics are now matched against the same day's stored records from *other* sources, with an explicit source-priority order (manual outranks every provider; a direct provider outranks a relay). The losing record is skipped or soft-deleted, never hard-deleted, and both sync results and `sync_job_runs` carry `skippedCrossProviderCount`/`supersededCrossProviderCount` so the decision is inspectable. See `packages/application/src/modules/integrations/cross-provider-dedup.ts`.
