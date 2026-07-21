# Technical Debt Register — FitnessApp

**Last updated:** 2026-07-21 (muscle-group tracking + coaching-rule audit)
**Methodology:** Items are ordered by impact × effort ratio. Fix high-impact, low-effort items first.

---

## Priority 1 — Active Debt

### TD-018: No application-level login/signup rate limiting

- **Severity:** Medium (health data account, single-user app, but still worth closing)
- **Affected files:** `apps/web/src/app/(auth)/actions.ts`
- **Problem:** `loginAction`/`signupAction` have no throttling, lockout, or attempt tracking of their own — they rely entirely on whatever Supabase Auth enforces server-side, which isn't configurable or visible from this codebase.
- **Fix:** Add a small DB-backed attempt log (table + repository) keyed by email, with a short lockout window after N failures in a rolling period.
- **Effort:** M (new migration + repository + service + wiring + tests)

### TD-019: No cross-provider duplicate detection for cardio/body-metric data

- **Severity:** Medium (real double-counting risk once 2+ providers are connected)
- **Affected files:** `packages/jobs/src/orchestration/*-sync.ts`, cardio/body-metric repositories
- **Problem:** Unique indexes prevent the _same_ provider from re-importing the _same_ external ID, but nothing detects the _same real-world event_ arriving from two different providers (e.g. a Peloton ride landing via both a direct sync and a Strava auto-export, or a Withings weigh-in also appearing via an Apple Health bridge). Today, connecting two overlapping sources can double-count volume, calories, or weight trend.
- **Fix:** A conservative same-day + similar-duration/weight heuristic per data type, with an explicit source-priority order (e.g. Withings > Apple Health for weight; direct provider > Strava relay for cardio) and a way to inspect which record won.
- **Effort:** L

---

## Priority 2 — Low Severity

### TD-016: `listByDateRange` capped at 500 rows

- **Severity:** Low (acceptable for current scale)
- **Affected files:** All 6 infrastructure repository implementations
- **Problem:** Safety cap of 500 rows was added to prevent unbounded queries. Power users with >500 entries in a date range will silently get a truncated result.
- **Fix:** Add a `limit` parameter to repository port interfaces; pass caller-controlled limits from server.ts files; default to 365 for chart views.
- **Effort:** M (requires interface changes across application + infrastructure layers)

### TD-020: `duration_seconds` / `distance_meters` still dead columns on strength sets

- **Severity:** Low
- **Affected files:** `packages/domain/src/modules/strength/strength-session.ts`, `packages/infrastructure/src/repositories/strength-session-repository.ts`, strength form/UI
- **Problem:** These columns exist in `strength_exercise_sets` (for timed sets like planks and distance-based movements like carries) but aren't wired to the domain type, repository mapper, or UI. `is_warmup` had the same problem and was fixed this session (see Resolved Debt) — this is the same shape of fix for the two remaining dead columns.
- **Fix:** Same pattern as the `is_warmup` fix: domain field → repo mapper → form schema → quick-form UI (likely a "timed/distance set" toggle that swaps the reps+weight inputs for duration/distance inputs).
- **Effort:** M

### TD-021: No user-editable exercise catalog or per-user aliases

- **Severity:** Low
- **Affected files:** `packages/application/src/modules/strength/exercise-catalog-data.ts`
- **Problem:** The muscle-group/movement-pattern catalog added this session is a static, in-code list scoped to the user's home-gym equipment. It resolves common naming variants via aliases, but exercises outside the catalog (or unusual personal shorthand) resolve to `null` and are excluded from muscle-group/push-pull reporting (visibly, via `unclassifiedWorkingSetCount` — never silently dropped). There's no UI to add a custom exercise to the catalog or teach it a new alias.
- **Fix:** A small "exercise catalog" table + admin UI, or at minimum a per-user alias override table, once uncategorized volume becomes a recurring nuisance in practice.
- **Effort:** M

### TD-022: No account deletion or full data-export flow

- **Severity:** Low (single-user app today, but this is health data)
- **Affected files:** `apps/web/src/features/settings/`
- **Problem:** No self-service "delete my account" or "export all my data" action exists anywhere in the app.
- **Fix:** A settings action that either hard-deletes (cascades already exist via `on delete cascade` FKs) or exports all rows scoped to `auth.uid()` as JSON/CSV.
- **Effort:** M

---

## Resolved Debt

| ID      | Description                                                                                                                                                                                                                                                                                                           | Resolved   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| TD-R01  | `react/no-unescaped-entities` lint error in `dashboard/page.tsx`                                                                                                                                                                                                                                                      | 2026-04-05 |
| TD-R02  | README had duplicate step number (two "5.")                                                                                                                                                                                                                                                                           | 2026-04-05 |
| TD-001  | Delete actions missing error handling — all delete actions now have try/catch                                                                                                                                                                                                                                         | 2026-04-05 |
| TD-002  | Duplicate `getErrorMessage()` across 7 action files — extracted to `lib/server/get-error-message.ts`                                                                                                                                                                                                                  | 2026-04-05 |
| TD-003  | Misleading strength validation message — fixed                                                                                                                                                                                                                                                                        | 2026-04-05 |
| TD-004  | `parseOptionalNumber` duplicated — extracted to `lib/form-utils.ts`                                                                                                                                                                                                                                                   | 2026-04-05 |
| TD-005  | `createDependencies()` duplicated — extracted to `lib/server/services.ts`                                                                                                                                                                                                                                             | 2026-04-05 |
| TD-006  | `ensureProfileForUser` running on every render — wrapped with React `cache()`                                                                                                                                                                                                                                         | 2026-04-05 |
| TD-007  | No field-level error display in forms — added `fieldErrors` to body, recovery, cardio forms                                                                                                                                                                                                                           | 2026-04-05 |
| TD-008  | Dashboard no caching — React `cache()` on supabase client, auth, and profile fetch                                                                                                                                                                                                                                    | 2026-04-05 |
| TD-009  | Unbounded `listByDateRange` queries — `.limit(500)` added to all 6 repositories                                                                                                                                                                                                                                       | 2026-04-05 |
| TD-010  | No shared service composition root — `createCoreServices()` in `lib/server/services.ts`                                                                                                                                                                                                                               | 2026-04-05 |
| TD-011  | Hardcoded timezone `"America/Chicago"` at signup — browser timezone auto-detected via `Intl`                                                                                                                                                                                                                          | 2026-04-05 |
| TD-012  | Nutrition module placeholder — full module built                                                                                                                                                                                                                                                                      | 2026-04-05 |
| TD-013  | No E2E test coverage — Playwright set up with 4 spec files                                                                                                                                                                                                                                                            | 2026-04-05 |
| TD-015  | `integration_connection_credentials` RLS/policy gaps — fixed                                                                                                                                                                                                                                                          | 2026-04-05 |
| TD-014  | No background job execution infrastructure — `sync_job_runs` wired up as a retry queue via Supabase pg_cron + pg_net (15-min sweep at `/api/cron/retry-failed-syncs`, exponential backoff, `dead_letter` status after 5 attempts); added `/api/cron/withings-sync` scheduled route                                    | 2026-07-15 |
| TD-017  | `insights-generate` cron not scheduled — added to `vercel.json`                                                                                                                                                                                                                                                       | 2026-07-15 |
| TD-011b | Timezone not validated server-side at signup — was already fixed prior to this doc noticing (see `isValidTimezone()` in `apps/web/src/app/(auth)/actions.ts`, validated against `Intl.supportedValuesOf('timeZone')` with a UTC fallback) — doc drift only, no code change needed                                     | 2026-07-21 |
| TD-023  | No muscle-group/push-pull volume tracking anywhere — added an in-code exercise catalog (muscle group + movement pattern + compound/isolation, with aliases), a `computeMuscleGroupVolume()` aggregation service, a "Muscle group balance" card on `/strength`, and a "not trained this week" callout on the dashboard | 2026-07-21 |
| TD-024  | `is_warmup` was a dead DB column (existed in schema, never reached domain/UI) — wired end-to-end; warm-up sets are now excluded from working volume, PR detection, and progression trends                                                                                                                             | 2026-07-21 |
| TD-025  | Coaching insight engine was missing several high-value rules from the product spec (muscle-group neglect, push/pull imbalance, deload suggestion, consistently-exceeding-cardio-target) — 4 new rules added with tests                                                                                                | 2026-07-21 |
| TD-026  | OAuth callback routes (Strava, Withings) and Apple Health webhook routes returned raw `error.message` to the client/redirect URL on failure — now sanitized to generic messages with full detail logged server-side only                                                                                              | 2026-07-21 |
