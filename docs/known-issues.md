# Known Issues

**Last verified against code:** 2026-10-12.

## Fixed 2026-10-12

- Live was missing 47 indexes from `20260331192000_create_indexes.sql`, including the per-date unique index on `recovery_checkins`. With Apple Health creating each day's row overnight, the next manual check-in from `/recovery` would have inserted a second row for the same date, and `findByDate` (`maybeSingle`) would then have failed every later sleep sync for that day. No duplicates existed yet. Restored 42 of them (`20261012173941_restore_missing_live_indexes.sql`, applied live). Left out: `raw_import_events_provider_dedupe_idx` (about 420 identical raw events from HAE resends already violate it) and `sync_job_runs_active_dedupe_idx` (one stale queued/running pair).
- `/recovery` now opens today's synced row prefilled and saves into it; a create for a date that already has a row merges into it (blank fields keep stored values). The collapsed "optional metrics" fields were unmounted, so a save never sent resting HR, HRV, cold plunge or notes; saving over a synced row would have blanked its resting HR and HRV. They are now hidden, not unmounted, and cold plunge sits in the main form.

## Fixed 2026-10-11

- Retry storm in `/api/cron/retry-failed-syncs`. Once the 10/9 POST fix let the 15-minute sweep run, every failed retry wrote a fresh `failed` row (`trigger_type = 'retry'`, attempt 0) that the next sweep picked up as a new queue entry. A dead Strava connection grew it to about 9,100 failed rows a day (about 19,600 in `sync_job_runs` by 10/11). Each failed locally on "No stored credentials", so Strava was never called; the cost was table bloat and about 96 wasted function runs a day. The sweep now skips retry-spawned rows (`isQueueEntry`); the original row still walks its 5 attempts to dead-letter. The junk rows are left in place (no hard deletes).

## Fixed 2026-10-09

- pg_cron POSTs to `/api/cron/withings-sync` and `/api/cron/retry-failed-syncs`, but both exported only GET, so every scheduled run since they were added returned 405. Withings only synced on manual button presses (last body metric before the fix: 2026-07-23). Both now accept POST; a production run synced 19 new rows.
- The app shell's `<main>` had `backdrop-filter`, which pinned the lift logger's fixed Finish bar and rest timer to the bottom of the page instead of the screen.
- `/recovery` keyed today on UTC, so evening supplements logged to tomorrow.

## Fixed 2026-08-26 (see CURRENT_STATE.md session log)

- Session cookies were readable from JavaScript (`httpOnly` unset); open redirect via a backslash-prefixed `redirectTo`; Strava/Peloton sync failures that recorded nothing and were never retried; Apple Health webhooks with no body-size or array-length bound; no security headers.
- `computeJournalStreak` skipped a day at positive UTC offsets; the Saturday-missed rule fired on an in-progress Saturday; the missing-weekly-review nudge fired on empty accounts; three dashboard goal-progress miscalculations (VO2 boundary double-count, fat-loss pace divided by a fixed 4 weeks, UTC `today` in a user-local streak).
- The Apple Health sleep sync rewrote a valid 1440-minute value as 24 minutes.
- `public.trigger_cron_route` was `SECURITY DEFINER` and executable by `anon` via PostgREST RPC, concatenating a caller-supplied `route_path` onto the base URL with no validation — so `"@evil.example/x"` escaped to that host carrying the cron bearer secret. EXECUTE revoked and a route allowlist added inside the function (2026-08-27).
- `/api/account/export` silently truncated at 500 rows per table.

## Current weak spots

- The Playwright suite predates the login removal; `tests/e2e/strength.spec.ts` (2026-10-09) is read-only and safe against the live database, the others create rows.

- Playwright E2E covers auth, navigation, body, cardio, integrations connect flow, and weekly-review (6 specs); the remaining modules (strength, recovery, nutrition, journal, insights, settings) have no browser coverage yet.
- E2E does not run in CI — Playwright's `webServer` needs a live Supabase project, and CI has no credentials for one. The GitHub Actions workflow (`.github/workflows/ci.yml`) runs format, typecheck, lint, unit tests, and the production build only.
- OAuth callback and sync behavior are covered by unit tests, not live-provider integration tests.
- Withings is live and, since 2026-10-09, actually scheduled (see above). Apple Health is live through Health Auto Export (hourly, since 2026-10-12) and is the only cardio-import path; Strava and Peloton code was removed 2026-10-12.
- Integration credentials are intentionally server-only and require correct service-role usage in deployment.
- Insight severity is computed by the rule engine and then dropped at the storage boundary: there is no `severity` column, so `InsightOrchestrator` hides it in the `evidence` JSONB and nothing reads it back. `listActive` orders by `insight_date desc`, and both "top 3" call sites are a bare `slice`, so the dashboard shows the three most recent insights rather than the three most important. Open and unfixed as of 2026-08-27 — it needs a product decision, not just a patch. See CURRENT_STATE.md.
- Nutrition targets are personalized as of 2026-08-27 (TD-030 closed): `height_cm`/`birth_date`/`biological_sex` are on `profiles` and used in the BMR formula, falling back to population averages per-field and disclosing exactly which ones fell back.

## Resolved since this file was last accurate

The 2026-07-15 audit corrected this file once; it drifted again. These were listed as open here but had already shipped:

- **TD-018** — application-level login/signup rate limiting (DB-backed rolling window). Shipped.
- **TD-020** — `duration_seconds`/`distance_meters` on strength sets wired through to the UI. Shipped.
- **TD-021** — user-editable exercise catalog overrides and per-user aliases. Shipped.
- **TD-022** — account deletion and full data export ("Danger zone" in Settings). Shipped.
- **TD-019** — cross-provider duplicate detection. Shipped 2026-08-26: imported cardio sessions and body metrics are now matched against the same day's stored records from *other* sources, with an explicit source-priority order (manual outranks every provider; a direct provider outranks a relay). The losing record is skipped or soft-deleted, never hard-deleted, and both sync results and `sync_job_runs` carry `skippedCrossProviderCount`/`supersededCrossProviderCount` so the decision is inspectable. See `packages/application/src/modules/integrations/cross-provider-dedup.ts`.
