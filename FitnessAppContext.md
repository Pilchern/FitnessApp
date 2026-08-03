# FitnessApp — Living Context Document

> This file is the canonical reference for ongoing Claude Code work on this app.
> Update it as the app evolves. It is used to orient any new agent or session.

---

## What This App Is

A personal health, fitness, recovery, and body-composition tracking app built for one primary user (performance-minded athlete). It is **manual-first** (you can log everything without any integrations) and **provider-optional** — four provider integrations exist in code: Strava (code live, currently broken — app deactivated, user must reactivate), Withings (body metrics, live and verified), Peloton (cardio, code complete, but the unofficial API is confirmed blocked by Peloton — use Peloton's native Strava auto-export instead), and Apple Health (sleep + daily activity, live, static-bearer or HMAC auth).

The app is not a calorie counter or social fitness platform. It is a weekly coaching loop: log training, recovery, and body data → run a weekly review → get rule-based insights → adjust next week.

---

## Technology Stack

| Layer              | Technology                               |
| ------------------ | ---------------------------------------- |
| Monorepo manager   | pnpm 10 workspaces                       |
| Language           | TypeScript 5.7 (strict)                  |
| Frontend framework | Next.js 15 (App Router, React 19)        |
| Styling            | Tailwind CSS 3.4                         |
| Database           | Supabase / PostgreSQL                    |
| Auth               | Supabase Auth (email/password)           |
| ORM / DB client    | Supabase JS SDK                          |
| Validation         | Zod 3                                    |
| Testing            | Vitest 2                                 |
| Lint               | ESLint (next/core-web-vitals + prettier) |
| Format             | Prettier 3                               |

---

## Monorepo Structure

```
apps/
  web/             → Next.js 15 App Router delivery shell
packages/
  domain/          → Pure domain types, zero dependencies
  application/     → Use cases, services, repository ports, DTOs
  infrastructure/  → Supabase repository implementations
  integrations/    → Strava, Withings, and Peloton adapters (OAuth/credential + payload normalization)
  jobs/            → Background sync orchestration (cardio, body-metric, Apple Health sleep)
supabase/
  migrations/      → 27 SQL migration files
  seed/            → Local dev seed (dev@example.com / password1234)
docs/              → Architecture and schema notes
tests/             → E2E placeholders and shared fixtures
```

---

## Package Dependency Graph

```
web → application → domain
web → infrastructure → domain
web → integrations → application + domain
web → jobs → infrastructure + integrations + application
```

All packages except `web` are framework-free and portable.

---

## Key Files to Know

| File                                           | Purpose                                        |
| ---------------------------------------------- | ---------------------------------------------- |
| `apps/web/src/middleware.ts`                   | Route protection, auth redirects               |
| `apps/web/src/app/(auth)/actions.ts`           | Login, signup, logout server actions           |
| `apps/web/src/app/(protected)/layout.tsx`      | Protected shell with nav and profile bootstrap |
| `apps/web/src/lib/server/profile-bootstrap.ts` | Creates default profile on first login         |
| `apps/web/src/lib/auth.ts`                     | `sanitizeRedirectTo`, `mapAuthErrorMessage`    |
| `apps/web/src/lib/navigation.ts`               | All route definitions + module metadata        |
| `packages/application/src/index.ts`            | All exported services, schemas, helpers        |
| `packages/infrastructure/src/index.ts`         | All exported repositories                      |
| `supabase/migrations/`                         | Ground truth for DB schema                     |

---

## Feature Module Status

| Module        | Route            | Status                                                                                                                                                     |
| ------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard     | `/dashboard`     | Implemented — 6 parallel queries, basic cards                                                                                                              |
| Cardio        | `/cardio`        | Implemented — Zone2/VO2/recovery/other, full CRUD                                                                                                          |
| Strength      | `/strength`      | Implemented — Sessions + sets, RIR tracking, warm-up marking, muscle-group/movement-pattern volume balance (2026-07-21)                                    |
| Recovery      | `/recovery`      | Implemented — RHR, HRV, sleep, readiness                                                                                                                   |
| Body          | `/body`          | Implemented — Weight/waist/body fat, trends                                                                                                                |
| Weekly Review | `/weekly-review` | Implemented — Scoring engine, reflection fields                                                                                                            |
| Journal       | `/journal`       | Implemented — Tags, search, weekly-review links                                                                                                            |
| Insights      | `/insights`      | Implemented — Rule-based engine, dismiss/archive, plus optional AI-generated insights via `AiInsightService` (Claude API) when enabled                     |
| Settings      | `/settings`      | Implemented — Profile, timezone, units, goals, plus a Danger Zone (data export + account deletion, 2026-07-22)                                             |
| Integrations  | `/integrations`  | Implemented — UI for all 4 providers: Strava (live), Withings (OAuth, needs creds), Peloton (needs connected account), Apple Health (needs webhook secret) |
| Nutrition     | `/nutrition`     | Implemented — Daily log, macro tracking, CRUD                                                                                                              |

**Providers not present in a route table because they're webhook/cron-only:** Apple Health sleep + daily-metrics ingestion (`POST /api/integrations/apple-health/sleep`, `/daily-metrics`), Peloton cardio sync (`/api/cron/peloton-sync`), weekly review auto-draft (`/api/cron/weekly-review-auto-finalize`), and insights generation (`/api/cron/insights-generate`, scheduled in `vercel.json`).

---

## Database Tables (Quick Reference)

**Core tracking tables:**
`profiles`, `training_templates`, `cardio_sessions`, `strength_sessions`, `strength_exercise_sets`, `recovery_checkins`, `body_metrics`, `nutrition_logs`, `weekly_reviews`, `journal_entries`, `insights`, `daily_activity_metrics`, `supplements`, `supplement_logs`

**Integration audit tables:**
`integration_connections`, `integration_connection_credentials`, `import_batches`, `raw_import_events`, `sync_job_runs`

**Security tables:**
`auth_rate_limit_attempts` (login/signup rolling-window lockout, TD-018 — see 2026-07-21 session) — no `user_id`; identifier is the raw normalized email, since attempts against nonexistent accounts must be limited too

All tables have RLS enabled with user-scoped policies. Every row is scoped to `user_id = auth.uid()` (except `auth_rate_limit_attempts`, which has no `user_id` and no policies — service-role only).
`integration_connection_credentials` uses the service-role key (bypasses RLS) for OAuth/sync operations; RLS policies are also present for authenticated client access.

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
WITHINGS_CLIENT_ID            (optional, for Withings integration)
WITHINGS_CLIENT_SECRET        (optional)
WITHINGS_REDIRECT_URI
STRAVA_CLIENT_ID              (optional, for Strava integration — currently set, live)
STRAVA_CLIENT_SECRET          (optional)
STRAVA_REDIRECT_URI
INTEGRATION_ENCRYPTION_KEY    (base64-encoded 32-byte AES-256 key — required by Withings, Strava, Peloton, and Apple Health)
CRON_SECRET                   (Bearer token all 4 cron routes require)
ANTHROPIC_API_KEY             (optional — enables AiInsightService)
INSIGHT_AI_MODEL              (optional, defaults to claude-haiku-4-5-20251001)
INSIGHT_AI_ENABLED            (optional, "true" to activate AI insight generation)
```

Peloton needs no dedicated client ID/secret — it authenticates with a per-user Peloton username/password (encrypted at rest with `INTEGRATION_ENCRYPTION_KEY`), supplied through the connect flow, not an env var.

Apple Health also needs no dedicated env var beyond `INTEGRATION_ENCRYPTION_KEY` (as of 2026-07-16): each user generates their own webhook token from `/integrations`, stored encrypted in `integration_connection_credentials`, replacing the old app-wide `APPLE_HEALTH_WEBHOOK_SECRET` — see docs/integrations/apple-health-bridge-setup.md for why (that shared secret plus a client-supplied `X-User-Id` let any signed-up user write into any other user's data).

**Current state:** `.env.local` already populated with live Supabase project credentials. Withings credentials are empty (integration UI will show disconnected). No Peloton account is connected yet. Apple Health requires `INTEGRATION_ENCRYPTION_KEY` plus a per-user generated webhook token.

---

## Common Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start Next.js dev server
pnpm build            # Production build
pnpm lint             # ESLint (must be zero errors)
pnpm typecheck        # TypeScript across all packages
pnpm test             # Vitest across all packages
pnpm format           # Prettier check
pnpm format:write     # Prettier fix
```

---

## Key Architectural Patterns

### 1. Service + Repository Pattern

Every feature uses: `FeatureService(new SupabaseFeatureRepository(client))`

- Service lives in `packages/application`
- Repository interface (port) in `packages/application`
- Repository implementation in `packages/infrastructure`
- Wiring happens in `apps/web/src/features/*/server.ts` or `actions.ts`
- Shared factory: `apps/web/src/lib/server/services.ts` → `createCoreServices()` wires 7 services at once

### 2. Server Actions Pattern

All mutations flow through `"use server"` actions in `features/*/actions.ts`:

1. `requireCurrentUser()` — auth check
2. Zod validation via form schema
3. Service call
4. `redirect(path)` on success, `return parseActionError(error)` on failure (returns `{ error?, fieldErrors? }`)

### 3. Form Schema Pattern

Zod schemas in `features/*/form-schema.ts` handle FormData parsing (all strings from FormData → typed values). They use shared `parseOptionalNumber()` and `optionalString()` from `apps/web/src/lib/form-utils.ts`.

### 4. Field-Level Form Errors

Action state types include `fieldErrors?: Record<string, string>`. `parseActionError()` in `lib/server/parse-action-error.ts` extracts per-field Zod errors. Form components render `state.fieldErrors?.fieldName` below each input.

### 5. RLS as the Security Layer

All tables enforce ownership via `auth.uid() = user_id`. Server actions call `requireCurrentUser()` additionally for defense-in-depth. Service-role key is used only for admin/sync operations (bypasses RLS).

### 6. React `cache()` for Per-Request Deduplication

`createSupabaseRequestClient`, `getCurrentUser`, and `ensureProfileForUser` are wrapped with React `cache()`. Layout + page components sharing a render tree only hit Supabase once per function call type, not once per component.

---

## Known Technical Debt (Priority Order)

See `TECH_DEBT.md` for the full register. Active items as of 2026-08-02:

1. **No cross-provider duplicate detection** (TD-019) — re-escalated to a real (if not currently active) risk: Apple Health now syncs cardio workouts (see below), so reconnecting Strava or Peloton direct sync alongside active Apple Health workout sync could double-count a ride. Not live today only because Strava is paywalled and Peloton's API is blocked, leaving Apple Health as the sole active cardio path.
2. **Nutrition calorie/protein targets ignore age, height, and sex** (TD-030) — `NutritionTargetService` substitutes population-average defaults for inputs the profile doesn't collect. Partially mitigated 2026-08-02 (safety floor + UI disclosure so the estimate isn't presented as precise); full fix needs a schema migration (add `heightCm`/`ageYears`/`biologicalSex` to `profiles`), deliberately deferred pending user/schema-owner availability.
3. **Withings and Peloton unconfigured** — code-complete, waiting on credentials/connection (Peloton direct sync is additionally blocked by Peloton's own API); not tracked as debt, just an environment/account setup gap

Resolved 2026-08-02: false personal-record badges from an uncapped 1RM-estimate formula (TD-031 — capped the rep term used in `setScore()` at 12), recovery coaching ignoring soreness (TD-032 — added a soreness check ahead of the readiness checks in `getRecoveryCoachingSuggestion()`), 12 missing `aria-label`s on the strength logging/template/exercise-classification forms (TD-033), missing upper bounds on strength weight/reps (TD-034 — added sanity bounds at client and application layers), and unconstrained AI-coaching prompts with no AI/rule source distinction in the UI (TD-035 — added safety rules to both LLM prompts and an "AI" badge/disclaimer to `/insights`).

Resolved 2026-07-25: `listByDateRange` caller-controlled `limit` (TD-016 closed) — added an optional `limit` field to the shared `dateRangeQuerySchema`, defaulting to the same 500-row cap for every existing caller via `DEFAULT_DATE_RANGE_QUERY_LIMIT`, so a future caller that genuinely needs more rows in a date range can ask for up to 2000 instead of silently truncating.

Resolved 2026-07-25: Apple Health workout sync (TD-029, `POST /api/integrations/apple-health/workouts`) — a free, provider-agnostic path for Peloton rides (or anything else HealthKit captures) to reach `cardio_sessions`, now that Strava requires a paid subscription the user declined. All 3 previously-pending migrations were also applied directly to the live Supabase project this session via the Supabase MCP connector.

Resolved 2026-07-22: account deletion + full data-export flow (TD-022, "Danger zone" section on `/settings`), user-editable exercise catalog overrides (TD-021 — per-user muscle-group/movement-pattern/category classification checked before the built-in catalog, with a "Classify your exercises" UI on `/strength`), numeric goal targets + training-plan day-of-week scheduling (TD-027 — target weight/date on the profile, `scheduledDayOfWeek` on `TrainingTemplate` with a "Today's plan" callout on `/strength`), and a fix for a completely broken strength-template-creation flow found along the way (TD-028 — web/application field-name mismatch meant every template creation silently failed validation).

Resolved same day: login/signup rate limiting (TD-018, DB-backed rolling-window lockout) and `duration_seconds`/`distance_meters` dead columns (TD-020) — see TECH_DEBT.md Resolved Debt.

---

## What Still Needs Building

**Next sprint priorities (see task-level plan for full detail):**

1. Configure Withings OAuth end to end
2. Cross-provider duplicate detection + source-priority rules (TD-019) — re-escalated; prioritize before ever reconnecting Strava/Peloton direct sync alongside Apple Health workout sync
3. Set a target weight/date under Settings, and pin real M/W/F strength templates with a scheduled day — the underlying capability (TD-027) is built and its migration is live, but the numbers/templates themselves are personal data that has to come from the user
4. Once the user resumes Peloton riding (currently paused for a meniscus injury), configure a bridge app (Health Auto Export or similar) to export "Workouts" data to `/api/integrations/apple-health/workouts` — see `docs/integrations/apple-health-bridge-setup.md`
5. Decide whether to keep the Strava/Peloton-direct integration code paths at all now that neither is realistically usable (Strava paywalled, Peloton API blocked) — not urgent
6. Tech-debt register is now down to a single item (TD-019, conditional on reconnecting Strava/Peloton) — next new work should come from the "Longer-horizon work" list below or explicit user direction rather than debt burn-down

**Already built, previously undocumented:**

- Peloton adapter, connect route, weekly cron, and UI card
- Apple Health sleep + daily-metrics webhooks + orchestrators
- AI-generated insights via `AiInsightService` (Claude API) — feeds the Insights module, not a weekly-review narrative
- Weekly review auto-draft cron (creates a draft with computed summary + blank journal reflection; no AI narrative)
- Muscle-group/movement-pattern exercise catalog and volume aggregation (2026-07-21) — `packages/application/src/modules/strength/exercise-catalog-data.ts` and `muscle-group-volume.ts`
- User-editable exercise catalog overrides (2026-07-22) — `packages/application/src/modules/strength/exercise-override.ts`, checked before the built-in catalog in `resolveExercise()`
- Numeric goal targets + training-plan day-of-week scheduling (2026-07-22) — `targetWeightLb`/`targetDate` on the profile, `scheduledDayOfWeek` on `TrainingTemplate`, "Today's plan" callout on `/strength`
- Apple Health workout sync (2026-07-25) — `POST /api/integrations/apple-health/workouts`, `AppleHealthWorkoutSyncOrchestrator`, maps individual HealthKit workouts into `cardio_sessions`

**Longer-horizon work:**

- Mobile-responsive audit and polish pass
- Export/data-portability
- Superset/circuit grouping, unilateral (per-side) tracking, rest timer, lbs/kg unit toggle, and a "previous performance for this exercise" inline hint while logging — none of these exist in the strength module yet

---

## Testing Notes

- **Framework:** Vitest 2 (all packages), Playwright (E2E)
- **Current coverage:** 257 unit/integration tests across application, integrations, jobs, and web layers
- **Test seed user:** `dev@example.com` / `password1234` (local Supabase only)
- **E2E:** `tests/e2e/` — auth, navigation, body, and cardio specs; configured in `apps/web/playwright.config.ts`
- **Run unit tests:** `pnpm test` from root
- **Run E2E tests:** `cd apps/web && npx playwright test`

---

## Agents Available

See `AGENTS.md` for full agent system prompts. Agents defined:

1. Architecture Agent
2. Frontend UX Agent
3. QA and Testing Agent
4. Bug Triage Agent
5. Performance Agent
6. API and Backend Agent
7. Data and Schema Agent
8. Security Agent
9. Product Manager Agent
10. Documentation Agent

---

## Session History

| Date       | Work Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-02 | Follow-up: closed TD-035 — the two LLM-backed coaching features (`AiInsightService`, `AiWeeklyReviewService`) had prompts with zero safety constraints (no anti-diagnosis/anti-prescription/anti-guilt-language rules) despite the product's own "treat health guidance as sensitive" principle, and `/insights` rendered AI-generated and rule-based insights identically even though `sourceKind` was already tracked. Added explicit safety rules to both prompts, an "AI" badge on AI-sourced insight cards, and a page-level disclaimer on `/insights`. No new tests (prompt copy + UI label; verified via typecheck/lint/build). |
| 2026-08-02 | Follow-up: closed TD-034 — strength set `weight`/`reps` and template `targetWeight` had no upper bound at any layer (unlike sibling fields `rir`/`readinessPre`/`targetReps` on the same schemas), so an obvious data-entry error (e.g. `weight: 99999`) would pass through untouched and corrupt PR detection/volume math. Added sanity bounds (weight ≤ 2000lb, reps ≤ 1000) at the client and application layers. 4 new tests (257 total, up from 253). |
| 2026-08-02 | Full product/UX/security/fitness-safety audit. Fixed 4 issues: (1) nutrition calorie/protein targets used hardcoded age/height/sex defaults behind a "Recompute from my stats" button — added a 1200 kcal/day safety floor and an in-UI disclosure of what the estimate does/doesn't account for (TD-030, full personalization deferred pending a schema migration); (2) estimated-1RM scoring used an uncapped Epley formula, letting a light high-rep set falsely outscore a heavy top set as a "PR" — capped the rep term at 12 (TD-031); (3) the recovery coaching signal never checked soreness despite collecting it, so severe DOMS with a normal readiness score produced no caution — added a soreness check ahead of readiness (TD-032); (4) 12 missing `aria-label`s on the strength/template/exercise-classification forms (TD-033). Security/auth audit pass found no new issues. 253 tests total, up from 236 (17 new). Build/lint/typecheck all clean. PR #18 merged. |
| 2026-07-25 | Closed TD-016: `listByDateRange` was hardcoded to a 500-row cap across all 7 infrastructure repositories that have it. Added an optional `limit` field to the shared `dateRangeQuerySchema` (max 2000), defaulting to the same 500 via `DEFAULT_DATE_RANGE_QUERY_LIMIT` for every existing caller — fully backward compatible, no server.ts call sites changed since none currently need more than 500 rows. 4 new tests (236 total, up from 232). Tech-debt register now down to a single conditional item (TD-019). |
| 2026-07-25 | Strava changed its API to subscriber-only; user declined to pay and separately tore their meniscus (Peloton riding paused). Added a new Apple Health workout webhook (`POST /api/integrations/apple-health/workouts`, `AppleHealthWorkoutSyncOrchestrator`) mapping individual HealthKit workouts into `cardio_sessions` — a free, provider-agnostic path for Peloton (or anything else) to sync once riding resumes. Applied all 3 previously-pending migrations directly to the live Supabase project via the Supabase MCP connector. Re-escalated TD-019 (cross-provider dedup) since Apple Health now syncs cardio data too. 4 new tests (232 total, up from 228). |
| 2026-07-22 | Closed TD-027: numeric goal targets (`targetWeightLb`/`targetDate` on the profile, editable under Settings, dashboard fat-loss card shows real progress-to-target/pace when set) + training-plan day-of-week scheduling (`TrainingTemplate.scheduledDayOfWeek`, "Today's plan" callout on `/strength`). Also fixed TD-028: strength-template creation was completely broken — the web-layer validation schema expected `name/sets/reps/rpe/notes` but the create-template form always sent `exerciseName/exerciseOrder/targetSets/targetReps/targetWeight/targetRir/notes`, so every submission failed; fixed by validating against the correct shared `strengthTemplateExerciseSchema`. New migration `20260722180000` not yet applied to the live project. 11 new tests (228 total, up from 217). |
| 2026-07-22 | Closed TD-021: user-editable exercise catalog overrides. New `exercise_muscle_group_overrides` table (migration not yet applied to the live project) + `ExerciseOverrideService` (classify/archive/listActive); `resolveExercise()` checks per-user overrides before the built-in catalog; `computeMuscleGroupVolume()` accepts overrides and returns `unclassifiedExerciseNames`; new "Classify your exercises" UI on `/strength`. Re-scoped TD-019 from "active Medium-severity risk" to "forward-looking hardening" after confirming Apple Health doesn't yet sync body weight/cardio (no live duplicate-import path exists today). 7 new tests (217 total, up from 210). |
| 2026-07-22 | Closed TD-022: full data-export route (`GET /api/account/export`, RLS-scoped, explicitly excludes integration credentials/raw payloads) and account deletion ("Danger zone" on `/settings`, requires typing "DELETE", cascades via `admin.auth.admin.deleteUser()`). Wired the previously-unused `DailyActivityMetricService` into `createCoreServices()`. 5 new tests (210 total, up from 205). |
| 2026-07-21 | Muscle-group/movement-pattern exercise catalog + volume aggregation (biggest gap vs. product goal — "am I neglecting a muscle group"), wired into `/strength` and dashboard. `is_warmup` wired end-to-end (was a dead DB column). 4 new coaching-insight rules (muscle-group neglect, push/pull imbalance, deload suggestion, cardio-target-exceeded). OAuth callback + Apple Health webhook error-message sanitization. Corrected doc drift (`vercel.json` cron list, TD-011b already-fixed status). 15 new tests (197 total, up from 177). `pnpm build` verified clean. Same-day follow-ups: `duration_seconds`/`distance_meters` wired end-to-end for timed/distance strength sets (TD-020); DB-backed login/signup rate limiting added (TD-018, new `auth_rate_limit_attempts` migration — not yet applied to the live project). 205 tests total. |
| 2026-07-15 | Docs reality audit: found Peloton adapter/cron/UI, Apple Health sleep webhook, AI-hooked Insights, and 2 more undocumented cron routes. Rewrote CURRENT_STATE.md, FitnessAppContext.md, docs/known-issues.md, docs/next-release-roadmap.md to match actual code. Corrected stale test count (49 → 86) and table name (`integration_credentials` → `integration_connection_credentials`).                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-04-05 | Full check-in: survey, run, test, audit. Fixed lint error + README bug. Created FitnessAppContext.md, AGENTS.md, CURRENT_STATE.md, TECH_DEBT.md, TESTING.md                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-04-05 | Sprint: nutrition module (full stack), field-level form errors (body/recovery/cardio), React cache() on auth+profile+supabase client, shared createCoreServices() factory, shared form-utils, parseActionError utility, delete action error handling, Playwright E2E setup (4 spec files), security fix (RLS policies + userId filter on credential repo), 49 tests passing                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
