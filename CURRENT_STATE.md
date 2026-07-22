# Current State — FitnessApp

**Last updated:** 2026-07-22 (user-editable exercise catalog overrides)
**Overall health:** Stable. TypeScript clean. 217 tests pass. Lint clean. Production build succeeds. **Two migrations awaiting manual apply:** `20260721190000_create_auth_rate_limit_attempts.sql` and `20260722170000_create_exercise_muscle_group_overrides.sql` have not been run against the live Supabase project (no `.env.local`/live DB credentials in this container) — run `supabase db push` (or apply via the dashboard) before login rate limiting or exercise-classification overrides take effect in production; until the rate-limit migration is applied, `checkLoginRateLimit`/`recordLoginAttempt` will log a Postgres "relation does not exist" error and fail open (logins still work, just unprotected); until the exercise-overrides migration is applied, classifying an exercise will fail with a similar "relation does not exist" error (the built-in catalog still works fine either way). Withings and Apple Health are live and verified. Strava is currently broken (app deactivated on Strava's side — user action required). Peloton's unofficial API auth endpoint is confirmed blocked by Peloton as of 2026-07-16 — direct Peloton sync is not currently viable; **Peloton → Strava relay (via Peloton's own "auto-export to Strava" setting) is now the recommended cardio path**, pending Strava reactivation.

This session's audit found the app's integration/data-integrity layer (auth, OAuth token encryption, RLS, per-provider dedup, webhook signature verification) in solid shape, but the product's stated #1 goal — knowing whether you're neglecting a muscle group — had zero supporting code anywhere. That was the highest-value gap and is now closed end-to-end: an exercise catalog with muscle-group/movement-pattern tagging, a volume aggregation service, a "not trained this week" dashboard callout, a muscle-group balance card on `/strength`, and 4 new coaching-insight rules (muscle-group neglect, push/pull imbalance, deload suggestion, consistently-exceeding-cardio-target). Since then: timed/distance set logging, login rate limiting, account deletion + data export, and (this session) user-editable exercise catalog overrides — TD-021, closed. See "What Was Done in This Session (2026-07-22, exercise catalog overrides)" below.

---

## Health Summary

| Dimension    | Status  | Notes                                                                                                                                                                                                                                                                                              |
| ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript   | CLEAN   | Zero errors across all 6 packages                                                                                                                                                                                                                                                                  |
| Lint         | CLEAN   | No warnings                                                                                                                                                                                                                                                                                        |
| Tests        | PASSING | 217/217 (42 web, 133 application, 14 integrations, 28 jobs)                                                                                                                                                                                                                                        |
| Build        | PASSING | `pnpm build` succeeds without a live `.env.local` — all data-dependent routes are dynamic, so no Supabase connectivity is needed at build time                                                                                                                                                     |
| E2E          | READY   | Playwright configured, 6 spec files (auth, navigation, body, cardio, integrations, weekly-review)                                                                                                                                                                                                  |
| Database     | LIVE    | Cloud Supabase project, credentials in .env.local                                                                                                                                                                                                                                                  |
| Integrations | PARTIAL | Withings and Apple Health live and verified. Strava currently broken (app deactivated, user must reactivate at strava.com/settings/api). Peloton direct sync confirmed blocked by Peloton's own API as of 2026-07-16 — use Peloton's native Strava auto-export instead once Strava is reactivated. |

---

## Architecture Summary

6-package pnpm monorepo. Strict layered architecture (domain → application → infrastructure). Next.js 15 App Router is a thin delivery shell over portable business logic packages.

```
apps/web                    Next.js App Router delivery shell
packages/domain             Pure domain types (zero dependencies)
packages/application        Services, use cases, Zod validation, repo ports
packages/infrastructure     Supabase repository implementations
packages/integrations       Strava, Withings, and Peloton OAuth/credential adapters + payload normalization
packages/jobs               Background sync orchestration (cardio, body-metric, Apple Health sleep)
supabase/                   27 SQL migrations, seed data, RLS policies
```

---

## Module Status

| Module        | Route                         | Implementation                                                                                                                                 | Known Issues                                                                                                                                                                                                                                                                                     |
| ------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard     | `/dashboard`                  | Complete                                                                                                                                       | None                                                                                                                                                                                                                                                                                             |
| Cardio        | `/cardio`                     | Complete                                                                                                                                       | None                                                                                                                                                                                                                                                                                             |
| Strength      | `/strength`, `/strength/[id]` | Complete, plus muscle-group/movement-pattern volume tracking, warm-up marking, timed/distance set logging, and user-editable exercise catalog overrides (2026-07-22)                     | A `failure` flag still isn't wired to the UI — no rest timer or superset grouping                                                                                                                                                                       |
| Recovery      | `/recovery`                   | Complete                                                                                                                                       | None                                                                                                                                                                                                                                                                                             |
| Body          | `/body`                       | Complete                                                                                                                                       | None                                                                                                                                                                                                                                                                                             |
| Nutrition     | `/nutrition`                  | Complete                                                                                                                                       | None                                                                                                                                                                                                                                                                                             |
| Weekly Review | `/weekly-review`              | Complete — includes weekly auto-draft cron                                                                                                     | No AI-generated narrative yet (score/why/what-worked/etc.) — only a rule-based numeric summary is auto-filled                                                                                                                                                                                    |
| Journal       | `/journal`                    | Complete — weekly cron also auto-drafts a reflection entry                                                                                     | None                                                                                                                                                                                                                                                                                             |
| Insights      | `/insights`                   | Complete — rule-based engine **plus** optional AI-generated insights (Claude API) when `ANTHROPIC_API_KEY` + `INSIGHT_AI_ENABLED=true` are set | AI insights are a distinct feature from an AI _weekly review_; no weekly-review-format AI output exists yet                                                                                                                                                                                      |
| Settings      | `/settings`                   | Complete, plus a Danger Zone (data export + account deletion, 2026-07-22)                                                                      | None                                                                                                                                                                                                                                                                                             |
| Integrations  | `/integrations`               | Complete UI for all 4 providers (Withings, Strava, Peloton, Apple Health)                                                                      | Withings and Peloton need credentials; Apple Health needs `INTEGRATION_ENCRYPTION_KEY` set, then each user generates their own webhook token from the Integrations page (2026-07-16: replaced the old shared `APPLE_HEALTH_WEBHOOK_SECRET` — see docs/integrations/apple-health-bridge-setup.md) |

---

## Integrations — Actual State (corrected 2026-07-15)

Prior versions of this doc said only Strava and Withings existed. That was wrong. Four provider integrations exist in code today:

| Provider     | Type                                                                      | Code location                                                                                                                                         | Cron/sync                                            | Configured?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strava       | OAuth 2.0                                                                 | `packages/integrations/src/providers/strava/`                                                                                                         | `/api/cron/strava-sync` (weekly, in `vercel.json`)   | Yes — live                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Withings     | OAuth 2.0                                                                 | `packages/integrations/src/providers/withings/`                                                                                                       | Manual sync via UI; no dedicated cron                | No — `WITHINGS_CLIENT_ID/SECRET/REDIRECT_URI` unset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Peloton      | Username/password against Peloton's unofficial API (no public API exists) | `packages/integrations/src/providers/peloton/peloton-adapter.ts`                                                                                      | `/api/cron/peloton-sync` (weekly, in `vercel.json`)  | **Blocked at the source.** Confirmed 2026-07-16: `POST https://api.onepeloton.com/auth/login` returns `403 Access forbidden. Endpoint no longer accepting requests.` for any credentials — Peloton has deliberately restricted third-party auth to this endpoint. Not a code bug; not fixable without reverse-engineering around a deliberate access restriction, which this project won't do. The adapter/cron/UI remain in place in case Peloton's policy changes, but the recommended path is Peloton's own "auto-export to Strava" setting instead. |
| Apple Health | Bearer/HMAC webhook, per-user token (sleep + daily metrics)               | `apps/web/src/app/api/integrations/apple-health/sleep/route.ts` + `daily-metrics/route.ts` + `packages/jobs/src/orchestration/apple-health-*-sync.ts` | Push-based (bridge app posts on a schedule), no cron | Yes, once `INTEGRATION_ENCRYPTION_KEY` is set and the user has generated a webhook token from `/integrations`                                                                                                                                                                                                                                                                                                                                                                                                                                           |

The Peloton adapter maps `avgOutput` (watts, derived from `total_output`), `cadenceMin`/`cadenceMax`, and `resistanceMin`/`resistanceMax`. The Strava adapter only maps `avgOutput` and `cadenceMin` (from `average_watts`/`average_cadence`) — `cadenceMax`, `resistanceMin`, and `resistanceMax` are always `null` via Strava, because Strava's activity model has no equivalent fields. Direct Peloton sync would be strictly higher-fidelity for cycling metrics than a Peloton→Strava→FitnessApp path — **but this is now moot**: Peloton's unofficial API auth endpoint is confirmed blocked (see the Peloton row above), so the only remaining automated path is the Strava relay, accepting the fidelity loss. A full-fidelity alternative — importing Peloton's own CSV workout-history export — was considered and rejected for now (would require building a new CSV import path; not started) in favor of the zero-code Strava relay. Revisit if the fidelity loss becomes a real pain point.

### Scheduled jobs (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/peloton-sync", "schedule": "0 8 * * 1" },
    { "path": "/api/cron/strava-sync", "schedule": "0 8 * * 1" },
    {
      "path": "/api/cron/weekly-review-auto-finalize",
      "schedule": "0 8 * * 1"
    },
    { "path": "/api/cron/insights-generate", "schedule": "0 8 * * 1" }
  ]
}
```

(`withings-sync` and `retry-failed-syncs` are scheduled separately via Supabase pg_cron, not `vercel.json` — see TD-014 in `TECH_DEBT.md`.)

A fourth cron route exists at `/api/cron/insights-generate` (generates rule-based + AI insights for every profile) and **is** registered in `vercel.json` (see below) — resolved as TD-017. The insight rule engine now also evaluates strength-session data (fetched via `strengthService.listByDateRange`) for muscle-group and push/pull coaching rules, not just cardio/recovery/weekly-review data.

None of the four cron routes have retry logic, a queue, or a dead-letter path — they use bounded concurrency (`mapWithConcurrency`, limit 3) and `Promise.allSettled`-style per-user error isolation only. See TD-014.

---

## Active Known Issues

### Critical

- None

### High

- None

### Medium

1. **Strava broken** — app deactivated on Strava's side (`403: Application Status Inactive`), confirmed via a failed `sync_job_runs` row on 2026-07-16. User must reactivate at strava.com/settings/api. This blocks the recommended Peloton→Strava relay path too.
2. **Peloton direct sync blocked by Peloton** — `POST https://api.onepeloton.com/auth/login` returns `403` for any credentials as of 2026-07-16. Not fixable without reverse-engineering around a deliberate access restriction. Recommended path is now Peloton's own "auto-export to Strava" setting, once Strava is reactivated.
3. **No cross-provider duplicate detection** (TD-019) — see `TECH_DEBT.md` Priority 1.

### Low

4. **`metrics.slice(0, 12)` in body server.ts** — Verify sort direction returns the 12 most recent entries for charts.
5. **`listByDateRange` capped at 500 rows** — This is intentional (was unbounded), but power users with >500 entries per date range will hit this cap. Acceptable for current scale. (TD-016)

### Resolved this session (2026-07-21)

- **Muscle-group tracking added end-to-end** — this was the single biggest gap versus the product's stated goal ("am I neglecting a muscle group"). New exercise catalog (`packages/application/src/modules/strength/exercise-catalog-data.ts`) tags ~45 common exercises with muscle group, movement pattern (push/pull/legs/core), and compound/isolation, with aliases so naming variants don't fragment history. New `computeMuscleGroupVolume()` service aggregates working-set volume by muscle group and movement pattern over any date range. Surfaced as a "Muscle group balance" card on `/strength` and a "not trained this week" callout on the dashboard.
- **`is_warmup` wired end-to-end** — was a dead DB column (existed in `strength_exercise_sets`, never reached the domain type, repository, form, or UI). Now flows through the full stack; warm-up sets are excluded from working volume, PR detection, and progression trend calculations.
- **4 new coaching-insight rules** added to the rule engine: `muscle_group_neglected` (e.g. chest trained, back skipped), `push_pull_imbalance` (14-day rolling volume ratio), `deload_suggested` (3 consistent training weeks + declining readiness), `cardio_target_consistently_exceeded` (positive). The rule engine now takes strength-session data as input, not just cardio/recovery/weekly-review data.
- **Doc-drift corrected**: this file's `vercel.json` snippet was missing `insights-generate` even though the actual file and TD-017 both confirmed it was scheduled; the "Active Known Issues" list still claimed it was unscheduled. `TD-011b` (timezone validation) was already fixed in code but still listed as open debt.
- **Security**: OAuth callback routes (Strava, Withings) and Apple Health webhook routes no longer pass raw `error.message` to the client/redirect URL — sanitized to generic messages with full detail logged server-side only.
- 15 new tests added (exercise catalog resolution, muscle-group volume aggregation, 4 new insight rules) — total went from 177 to 197.

### Resolved prior session (2026-07-15/16)

- Withings OAuth connected and verified — real sync landed 266 rows in `body_metrics` with `source_provider = 'withings'`.
- Apple Health extended beyond sleep (steps, VO2 max, resting HR, exercise minutes, active energy) — new `/api/integrations/apple-health/daily-metrics` endpoint.
- Apple Health webhook now supports a static bearer-token auth mode alongside HMAC, since no-code bridge apps (Health Auto Export) can't compute per-request signatures — automation is now actually achievable.
- Critical: RLS was disabled on 15 production tables — fixed.
- Schema additions shipped end-to-end: waist hip/gut, bedtime/wake time, cold plunge, supplement adherence.
- Background job retry/dead-letter infrastructure shipped via Supabase pg_cron + pg_net (TD-014).
- AI-generated weekly review draft shipped (score/why/what-worked/what-needs-attention/strategic-decision/risk-forecast/next-action), editable, never auto-committed.
- Peloton connect card (was computed server-side but never rendered) — fixed.

---

## Technical Debt Register

See `TECH_DEBT.md` for full prioritized list.

---

## Environment and Infrastructure

- **Database:** Supabase cloud project (credentials in `apps/web/.env.local`)
- **Auth:** Supabase Auth (email/password), sessions via HTTP-only cookies
- **Strava integration:** Code live, but currently broken — app deactivated on Strava's side, user must reactivate
- **Withings integration:** Live and verified — real sync confirmed landing data
- **Peloton integration:** Code complete (adapter, connect route, weekly cron, UI card) but the unofficial API auth endpoint is confirmed blocked by Peloton — use Peloton's native Strava auto-export instead
- **Apple Health integration:** Live for sleep and daily activity (steps/VO2 max/RHR/exercise minutes/active energy); two auth modes (static bearer for no-code bridge apps, HMAC for scripted clients)
- **AI insights:** `AiInsightService` (packages/application/src/modules/insights/ai-insight-service.ts) calls the Anthropic Messages API directly when `ANTHROPIC_API_KEY` is set and `INSIGHT_AI_ENABLED=true`; feeds the rule-based Insights module
- **AI weekly review:** `AiWeeklyReviewService` generates a Claude-authored draft (score/why/what-worked/what-needs-attention/strategic-decision/risk-forecast/next-action) stored separately from the canonical review fields until explicitly accepted — never auto-committed
- **Encryption key:** `INTEGRATION_ENCRYPTION_KEY` set (base64-encoded 32-byte AES-256 key) — required by Withings, Strava, and Peloton
- **Cron + retry:** 5 cron routes scheduled via `vercel.json`/pg_cron (peloton-sync, strava-sync, withings-sync, weekly-review-auto-finalize, retry-failed-syncs every 15min); `sync_job_runs` now used as a real retry queue with exponential backoff and a `dead_letter` terminal status after 5 attempts (TD-014, resolved)
- **Local Supabase:** Can be run locally with `supabase start && supabase db reset`
- **Seed user (local only):** `dev@example.com` / `password1234`
- **CI/CD:** None configured yet

---

## Active Priorities (Recommended Next Sprint)

1. User: reactivate Strava app at strava.com/settings/api
2. User: enable Peloton's native "auto-export to Strava" setting once Strava is reactivated, then connect Strava
3. User: apply migrations `20260721190000_create_auth_rate_limit_attempts.sql` and `20260722170000_create_exercise_muscle_group_overrides.sql` to the live Supabase project (`supabase db push`)
4. Cross-provider duplicate detection + source-priority rules for cardio/body metrics (TD-019) — now understood to be forward-looking hardening rather than an active bug, since Apple Health doesn't yet sync body weight/cardio data
5. Goal/training-plan entities with real targets and a 3-day split template that accounts for the user's shoulder/lower-back limitations (currently only 3 boolean profile flags exist — no numeric targets, no scheduled-workout concept)

---

## What Was Done in This Session (2026-07-21, muscle-group tracking + coaching-rule audit)

Full audit against the product's stated goals (dashboard clarity, coach intelligence, strength-tracking speed, security/data-integrity), using targeted research passes over the dashboard/insights, security, and strength-tracking code before making changes. See the "Resolved this session" entries above for the full list; summary:

1. Exercise catalog + muscle-group/movement-pattern volume tracking, end to end (domain → application → dashboard/strength UI).
2. `is_warmup` wired end-to-end (was a dead DB column).
3. 4 new coaching-insight rules (muscle-group neglect, push/pull imbalance, deload suggestion, cardio-target-exceeded).
4. OAuth callback and Apple Health webhook error-message sanitization.
5. Doc-drift correction (`vercel.json` cron list, TD-011b already-fixed status).
6. 15 new tests (197 total, up from 177); `pnpm build` verified clean.

**Follow-up (same day):** `duration_seconds`/`distance_meters` wired end-to-end on strength sets (TD-020) — same dead-column pattern as `is_warmup`. Timed sets (planks) and distance-based movements (farmer carries) can now be logged via two compact optional inputs next to the set-notes field. 1 new test (198 total).

**Follow-up 2 (same day):** DB-backed login/signup rate limiting (TD-018) — new `auth_rate_limit_attempts` table (migration `20260721190000`, not yet applied to the live project — see note above), a pure `evaluateLoginRateLimit()` lockout function (5 failures / 15-minute rolling window, resets on success) unit-tested independently of Supabase, and a thin server wrapper (`checkLoginRateLimit`/`recordLoginAttempt`) wired into both `loginAction` and `signupAction`. Fails open on a lookup error so a transient DB issue never locks out a legitimate user. 7 new tests (205 total).

---

## What Was Done in This Session (2026-07-22, account deletion + data export)

Closed **TD-022**, the last open low-severity item from the prior session's audit:

1. **Full data export** — `GET /api/account/export` returns every user-owned table (profile, body metrics, cardio sessions, recovery check-ins, strength sessions, weekly reviews, nutrition logs, journal entries, training templates, supplements + logs, daily activity metrics, active insights) as a downloadable JSON file, scoped by RLS via the request-scoped client. Deliberately excludes integration credentials/tokens, raw provider payloads, and sync-job bookkeeping — none of that is "your data" in the sense the export is for, and credentials must never leave the server.
2. **Account deletion** — a new "Danger zone" section on `/settings` requires typing "DELETE" to confirm, then calls `admin.auth.admin.deleteUser()`; every user-owned row cascades via existing `on delete cascade` foreign keys, no per-table cleanup needed.
3. **`DailyActivityMetricService` wired into `createCoreServices()`** — it existed in `packages/application`/`packages/infrastructure` but was never added to the composition root; needed for the export to include Apple Health daily-activity data.
4. 5 new tests (Zod confirmation-phrase schema: accepts exact "DELETE", rejects wrong case/empty/missing/similar-but-wrong phrases) — 210 total, up from 205.

---

## What Was Done in This Session (2026-07-22, user-editable exercise catalog overrides)

Closed **TD-021**, the last remaining item from the muscle-group-tracking audit: the built-in exercise catalog is a static, in-code list, so any exercise name it doesn't recognize (custom machines, personal shorthand) was permanently excluded from muscle-group/push-pull reporting with no way to fix it short of a code change.

1. **New `exercise_muscle_group_overrides` table** (migration `20260722170000`, not yet applied to the live project — see note above) — per-user classification (muscle group, movement pattern, category) keyed by `(user_id, normalized_name)`, RLS-scoped via `owns_row()`, soft-deleted via `deleted_at`.
2. **`ExerciseOverrideService`** (`packages/application/src/modules/strength/exercise-override.ts`) — `classify()` upserts by normalized name (re-classifying is the same action as classifying for the first time), `archive()` soft-deletes, `listActive()` lists a user's current overrides. `SupabaseExerciseOverrideRepository` implements the port.
3. **`resolveExercise()` now checks overrides before the built-in catalog** — a user's own classification always wins for names they've explicitly classified. `buildOverridesLookup()` builds the per-user lookup map once per request, shared across every `computeMuscleGroupVolume()` call (dashboard, `/strength`, insights rule engine, insights cron).
4. **`computeMuscleGroupVolume()` extended** — now takes an optional overrides map, and returns `unclassifiedExerciseNames: string[]` (distinct, sorted) alongside the existing `unclassifiedWorkingSetCount`, so the UI can offer a quick-classify action instead of just reporting a count.
5. **New "Classify your exercises" card on `/strength`** — lists every historically-logged exercise name that still doesn't resolve (checked across all-time sessions, not just the 7-day summary window), with an inline form (muscle group / movement pattern / category selects) per exercise; also lists the user's existing classifications with a one-click remove.
6. 7 new tests (override resolution via `resolveExercise`/`buildOverridesLookup`, `ExerciseOverrideService` classify/re-classify/archive behavior, `computeMuscleGroupVolume` override-aware resolution and `unclassifiedExerciseNames`) — 217 total, up from 210.
7. **TD-019 re-scoped**: while investigating what else touches the exercise-catalog area, confirmed Apple Health currently only syncs sleep and daily-activity metrics — not body weight or cardio workouts — so cross-provider duplicate detection has no live code path to actually trigger on today. Downgraded from "Priority 1, Medium severity, real risk" to "forward-looking hardening, revisit once Apple Health sync is extended."

---

## What Was Done in This Session (2026-07-15, docs reality audit)

Full repo grep for every integration provider, API route, job orchestrator, and cron actually present in code, cross-checked against `CURRENT_STATE.md`/`FitnessAppContext.md`. Found and corrected drift:

- Peloton adapter, connect route, weekly cron, and UI integration card exist and were undocumented (docs said only Strava + Withings).
- Apple Health sleep webhook (HMAC-signed) + orchestrator exist and were undocumented.
- `AiInsightService` already makes real Anthropic API calls for the Insights module — docs said "rule-based only, no AI hookup yet." (Still true that no _weekly-review-format_ AI narrative exists.)
- `/api/cron/weekly-review-auto-finalize` and `/api/cron/insights-generate` exist and were undocumented; the former is scheduled, the latter is not.
- Test count was stale (docs said 49; actual is 86).
- `docs/known-issues.md` and `docs/next-release-roadmap.md` were also stale (claimed no E2E suite exists and nutrition was a placeholder — both false) and have been corrected.

---

## What Was Done in This Session (2026-06-17, sprint 4)

P2/P3 code quality fixes:

1. **F-042 fixed** — Template exercises now Zod-validated before DB write. `templateExercisesSchema` added to `form-schema.ts`; `createStrengthTemplateAction` uses `.safeParse()` and returns a user-facing error on failure.
2. **F-056 fixed** — All `getErrorMessage` calls in `strength/actions.ts` replaced with `parseActionError`. Now re-throws redirect errors and surfaces `fieldErrors` from Zod.
3. **F-060 fixed** — Cross-orchestrator type imports eliminated. Shared store interfaces and input types moved to `packages/jobs/src/orchestration/shared-types.ts`. `body-metric-sync.ts` re-exports them for backward compatibility; `cardio-sync.ts` now imports directly from `./shared-types`.
4. **A-010 fixed** — In-memory dedup added to `cardio-sync.ts`. Tracks `userId|sessionDate|durationMinutes` per sync run; duplicate items within the same page are skipped and counted as `skippedDuplicateCount` in the result and sync job run log.
5. **F-047 checked** — Journal search already safe: Supabase JS client parameterizes `.ilike()` patterns; `.limit(500)` already applied before the search branch. No change needed.
6. **Strength form checked** — Form uses controlled `useState` inputs with `value=` on all fields. State survives server action errors without any additional work. No change needed.

---

## What Was Done in This Session (2026-04-05, sprint 3)

1. **Strava OAuth integration** — Full OAuth 2.0 flow, sync orchestration, weekly cron, Strava card UI
2. **DB migration applied** — `20260331210000_expand_cardio_sessions_v1.sql` applied to hosted Supabase; 95 rides imported successfully
3. **Delete actions error handling** — try/catch added to all delete server actions
4. **UI polish + consumer language** — ~35 files updated; all developer/technical language removed; status labels polished; consumer-first copy throughout
5. **Nutrition module verified** — Confirmed fully implemented across all layers
6. **E2E tests** — Playwright configured at repo root; `weekly-review.spec.ts` added; 4 spec files total
7. **TypeScript fixes** — `FinalizeOAuthConnectionInput` import corrected; `SaveConnectionInput` type extracted; `formatImportBatchStatus` fixed for real domain enum values
8. **Dead code removed** — `modulePageContent` map (placeholder dev content, never used in UI)
9. **TD-011 fixed** — Timezone auto-detected from browser at signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`; no longer hardcoded to `America/Chicago`
10. **TD-009 fixed** — `.limit(500)` added to all 6 `listByDateRange` repository implementations
