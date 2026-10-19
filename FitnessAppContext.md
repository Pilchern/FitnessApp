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

Resolved 2026-08-02: false personal-record badges from an uncapped 1RM-estimate formula (TD-031 — capped the rep term used in `setScore()` at 12), recovery coaching ignoring soreness (TD-032 — added a soreness check ahead of the readiness checks in `getRecoveryCoachingSuggestion()`), 12 missing `aria-label`s on the strength logging/template/exercise-classification forms (TD-033), missing upper bounds on strength weight/reps (TD-034 — added sanity bounds at client and application layers), unconstrained AI-coaching prompts with no AI/rule source distinction in the UI (TD-035 — added safety rules to both LLM prompts and an "AI" badge/disclaimer to `/insights`), missing upper bounds on cardio/recovery heart-rate fields (TD-036 — same pattern as TD-034, different module), missing upper bounds on body-metric weight/waist/composition fields and alcoholCount at the application layer (TD-037), and missing bounds on weekly-review summary and daily-activity-metric fields (TD-038, completing the sweep).

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
- **Current coverage:** 269 unit/integration tests across application, integrations, jobs, and web layers
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
| 2026-10-14 | Session 12. Docs only. Plan doc section 17: body composition plan (lean gain through January, cut Feb to May, June targets) pending the 2026-10-24 DEXA, decision rule for bulk vs lean gain, testing schedule and scan-day protocol. No code or migration. |
| 2026-10-13 | Session 11. First measured-Zone-2 ride verified live (16 of 30 min). Re-imported rides now refresh `zone2_minutes` when it differs, so earlier rides fill in on Health Auto Export's next 7-day re-push. Zone 2 HR band moved from 60-70% to 65-75% of Tanaka max (owner call: 60-70% credited 16 of a 30 min Z2 ride Peloton scored as all Z2). Two service tests added. No migration. |
| 2026-10-13 | Session 10. Strain (Banister TRIMP, app 0-21 scale) and sleep need/performance card; measured Zone 2 minutes from Health Auto Export workout heart rate; morning daylight auto-ticks the sunlight habit. |
| 2026-10-13 | Session 10. Fitness vs peers card: VO2 max vs FRIEND 2022 treadmill percentiles (age decade, sex), resting HR vs Quer 2020 wearable range (sex). Overnight-reading gate for nights with no sleep (#56). Non-exercise VO2 estimate dropped: coefficients unverifiable here. |
| 2026-10-13 | Session 10. Readiness v2: z-score composite with a hard 100 (all signals at or above baseline, settled baseline), overnight HRV and heart rate, wake-time consistency, penalties for wrist temperature, breathing rate and training-load spikes; hourly Health Auto Export overnight metrics mapped; `sleep_wrist_temp_c` column added. Peer ranking deferred to its own card. |
| 2026-10-12 | Session 5 close-out. Shipped #43 to #46 (production deploys READY for #43 to #45; #46 merged at close). Plan doc section 7 now anchors wake time at 6:30 and makes bedtime sleepy-gated (owner: not set in stone). Unverified at close: first HAE push after the index migration. Open items in CURRENT_STATE. |
| 2026-10-12 | Session 5, with the owner. Schedule confirmed (Tue/Thu/Sat lifts, Mon/Wed/Fri rides, Sunday rest; two Z2 plus one VO2 once cleared) in the plan doc; Strava/Peloton cardio sync orchestrator deleted; template plan-rule notes synced to plan doc section 4. |
| 2026-10-12 | Session 5 (autonomous). AI weekly-review context computes weeks post-op from the surgery date; plan doc drift fixed (Apple Watch stays, step habit auto-ticked, counts, done items). |
| 2026-10-13 | Session 9 (owner request). Every Mobility and Foundation Training step now has a tap-to-open how-to: numbered setup, what you should feel, the usual mistake, and a "Watch a demo" YouTube search link (a search, not a fixed video, so it cannot go dead; the panel warns demos may show deeper or floor versions). Opens from the step list before starting and from "How to do it" during each hold. Content in `HOW_TO` in `apps/web/src/lib/routines.ts`; the no-kneeling test now covers it. No images (a drawn figure set would be poor quality) and no embedded video (CSP blocks frames, and unvetted videos often show kneeling variants). Walked at 390x844 in Playwright against a dev preview. No migration. |
| 2026-10-12 | Session 8 (owner report: lift would not save). No lift had ever saved: `optionalString` rejected the null `id` FormData returns for a new session (silent, the logger hid field errors) and live lacked the April strength columns. Fixed the schema helper with a regression test, surfaced field errors in the logger, applied the strength, weekly-review and journal migrations to live (plus a new `cardio_sessions (id, user_id)` key the journal one needed), verified with a rolled-back insert, and confirmed no other repository column is missing on live. |
| 2026-10-12 | Session 8 (owner request). Schedule switched to lifts Mon/Wed/Fri (Push/Pull/Arms) and bike Tue/Thu/Sat (30/30/45, Saturday long). Live templates updated in place (day and name only); cardio-days label and AI plan context updated; plan doc sections 3, 5, 9, 12 and 14 updated. VO2 ride at clearance moves to Tuesday [assumed]. |
| 2026-10-12 | Session 8 (owner request). Built the guided Mobility (about 14 min) and Foundation Training (about 8 min) routines: follow-along timer with get-ready prep, beeps, wake lock, back/pause/next, and "Mark done for today" ticking the habit. Content in `apps/web/src/lib/routines.ts`, rehab-safe (no kneeling, nothing loading or twisting the left knee); held-back moves added to the PT ask list. Dashboard habit rows link to them. Walked in Playwright at 390x844 against a local production build with a fake clock (prep, hold, auto-advance, pause, skip, next, back, finish); found and fixed a RegExp passed to a client component that would have crashed the page. No migration. |
| 2026-10-12 | Session 8 (owner request). Apple Watch strength workouts from Health Auto Export now merge into the day's lift session (start, end, duration, avg/max HR, active kcal; Watch values win, resends no-op, same-day workouts combined) or create a Watch-only session that the next logger save fills. Migration `20261012230000_add_watch_fields_to_strength_sessions` adds the three columns. Tests for the mapper, combiner, merge planner and service. |
| 2026-10-12 | Session 7 (autonomous, full audit). Daily readiness score (0-100) from Apple Health HRV and resting HR against a robust 30-day personal baseline plus last night's and 7-night sleep, capped by soreness 8+ or a self-rating of 4 or less; no score without a 5-day baseline (`computeDailyReadiness`, application). Dashboard rebuilt around Today (readiness, today's call from readiness plus the planned session, contributors on tap), the week plan, habits, deterministic "What changed" notes (`buildTrendNotes`) and Body; removed the goal, training-week, recovery, nutrition and score-history cards, journal streak and coaching banner. Fixed: dashboard habits save bounced to /recovery (now tap-to-save in place); cardio adherence card hardcoded to Tue/Thu/Sat; Settings Recompute overwrote protein and the unset targets; first lift would have logged a PR per exercise; plan load could wipe a restored workout or a past session; sets silently truncated past ~1000 rows; push/pull insight counted bodyweight pulls as 0 lb (now working sets); recovery edits drifted sleep minutes and dropped Apple Health provenance; cardio edits dropped provenance. Recovery check-in visible fields cut to readiness, soreness, cold plunge; history is one row per night. Integrations card rewritten for Health Auto Export with staleness and failures. Plain page headers everywhere. Walked dashboard, recovery and the lift logger at 390x844 and 1280 in Playwright against a local production build with fixture data (no live DB from the container). 541 tests, typecheck, lint, format, build pass. |
| 2026-10-12 | Session 5 (autonomous). Recovery check-in merges into the day's Apple Health row instead of adding a second one, optional metrics no longer drop on save, cold plunge in the main form. Restored 42 indexes live never got from the March indexes migration. |
| 2026-10-12 | Session 5 (autonomous). Apple Health sleep start and end now fill the recovery check-in's bedtime and wake time (fill-only, manual entries win). |
| 2026-10-12 | Session 4, with the owner (5). Weekly review hidden from the nav; still linked from the dashboard score cards, and the Monday auto-finalize stays because insights and the score read its summary. |
| 2026-10-12 | Session 4, with the owner (4). Owner asked to drop unused pieces: Strava and Peloton removed (cards, actions, routes, crons, adapters, env); body form is tape-only, Withings owns weight, body fat and muscle; journal out of the nav and no longer auto-drafted. Dead code tracked as TD-042. |
| 2026-10-12 | Session 4, with the owner (3). Found /insights 500ing: the June insights unique-constraint migration was never applied to live, and the June energy-level widening was half applied. Applied both with owner approval; /insights renders and saves insights for the first time. |
| 2026-10-12 | Session 6. Visual refresh: slate/teal palette replaces the beige and muted pine (token values only in `tailwind.config.ts`, so every screen follows), system sans replaces Georgia/Trebuchet, flat page background, no panel wrapped around page content, subtle card shadow, tab bar icons, accent-colored checkboxes. Checked at 390x844 and 1280 wide with mock data in Playwright. No logic changes. |
| 2026-10-12 | Session 4, with the owner (2). TD-041 closed: insight rules use the weekly summary's template-derived Z2 target and scheduled counts; insights cron moved to 09:00 UTC Monday. After PT, edit only the cardio templates. |
| 2026-10-12 | Session 4, with the owner. Apple Health switched on: token generated, free Shortcut tried and dropped, Health Auto Export Premium Lifetime bought by the owner; hourly metrics and workouts automations live. Backfill: 7 days of steps, resting HR, HRV, sleep; 13 rides 9/17 to 10/10; steps habit auto-ticked. No code change. |
| 2026-10-12 | Session 4 (autonomous). Lift logger keeps the in-progress workout in localStorage and restores it after an iOS reload, tab-bar tap or failed save; cleared once the server shows the saved session. Verified live: production on 8abed52 READY and rendering, repo still public, production domain still outside Standard Protection, no Apple Health webhook credential, 0 strength sessions logged, Strava retry storm stopped 10/12 02:00 UTC. Vendor recheck: HAE Premium $24.99 lifetime or $6.99/yr (Basic $2.99 covers Shortcuts only), Strava API still needs a paid subscription, no official Peloton API. |
| 2026-10-11 | Session 3 (autonomous). Found the 15-minute retry sweep re-queuing its own retry rows since the 10/9 POST fix (about 9,100 failed rows a day from a dead Strava connection; never reached Strava, no credentials); sweep now skips `trigger_type = retry` (#35). Loaded timed sets show weight (farmer carry), "balance" counts as timed, so all five longevity tests log without a new feature (#36). Verified: repo still public, production domain outside Vercel Standard Protection with no login, no Apple Health webhook token yet, Strava API still paywalled, no official Peloton API. Docs: integrations table, Withings cadence, protection mode. |
| 2026-10-09 | Session 2 (autonomous). Raised a deployment-access decision with the owner (not recorded here). Fixed pg_cron POST 405s on withings-sync and retry-failed-syncs (Withings had not synced on schedule since July; first scheduled run pulled 19 rows); dropped dead Peloton/Strava Vercel crons (#28). Logger walked at 390x844 against a local production build: fixed the shell's backdrop-filter pinning the Finish bar and rest timer off-screen, timed-set prefill, `/recovery` UTC date (#29). Apple Health app side: Health Auto Export endpoint, step-habit auto-tick, steps and VO2 on dashboard, five-minute phone setup doc (#30). Weekly review plan adherence from templates; Plan card credits moved sessions (#31). Body card 7-day average, weekly delta, surplus throttle; read-only `/strength` e2e spec (#32). |
| 2026-10-09 | Removed login entirely (single-owner, service-role request client, no gate); mobile-first shell with bottom tab bar. Account deletion removed. Next: lift tracker mobile rework, plan alignment, sync sources. |
| 2026-08-03 | Follow-up: closed TD-038, completing the missing-sanity-bound sweep — `weekly_reviews.summary` had no bounds at all at the application layer (user-editable via `manualOverrides`), and `daily_activity_metrics` (Apple Health webhook-only) had no upper bounds anywhere. Added matching bounds to both; confirmed no other module has unbounded numeric fields left. 4 new tests (269 total, up from 265). |
| 2026-08-03 | Follow-up: closed TD-037 — same missing-upper-bound pattern (TD-034/036) found a third time in `body-metric.ts` (`weightLb`/`weightKg`/waist/muscle/bone/fat-free-mass/visceral-fat-index fields), most consequential instance yet since weight feeds `NutritionTargetService` directly. Also fixed `alcoholCount` on nutrition-log and recovery-checkin, which had a web-layer `.max()` but no application-layer one. 4 new tests (265 total, up from 261). |
| 2026-08-03 | Follow-up: closed TD-036 — same missing-upper-bound pattern as TD-034, found in cardio/recovery heart-rate fields (`avgHeartRate`/`maxHeartRate`/`restingHeartRate`/`hrv`) while re-checking the rest of the app for the strength-forms accessibility bug (which turned out to be isolated — every other feature form already labels its inputs correctly). Added sanity bounds (heart rate ≤ 250bpm, HRV ≤ 500ms) at client and application layers. 4 new tests (261 total, up from 257). |
| 2026-10-09 | Daily habits + lift-tracker prefill. Habits reuse the supplements tables via a new `supplements.kind` column (`supplement` \| `habit`, migration `20261009130000`, applied live; default keeps existing rows as supplements). Dashboard "Today's habits" checklist with 7-day counts (reuses `SupplementChecklist`, `logSupplementsAction` now honors a `returnTo` of /dashboard or /recovery), Settings has a separate Habits manager, Recovery shows supplements only. Loading a plan on `/strength` now prefills each set's weight from the last logged working sets of that exercise (falls back to the template target) and shows "Last (date): 165 x 8, 8, 7" above the first set (`buildLastByExercise`, `startingWeight`, 8 tests). Seeded live: lifts Tue/Thu/Sat, bike Z2 Mon/Wed/Fri, 4 habits. |
| 2026-10-09 | Dashboard "Plan" card: lays active training templates with a scheduled day over the current week, marks each Done/Missed/Planned from logged sessions, and shows Zone 2 minutes against a target summed from the scheduled cardio templates' `targetZone2Minutes` (no schema change; edit the templates to ramp the target). Pure logic in `buildWeekPlan` (`features/dashboard/helpers.ts`, 5 tests). Seeded live data (not in migrations): 3 upper-body strength templates (Mon/Tue/Thu), 3 bike Z2 templates (Tue/Thu/Sat), protein target 180 g. `profiles.baseline_schedule` is still unread by any code (stale pre-injury plan). Knee rehab stays in the separate PT Tracker app. |
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
| 2026-10-16 | Apple Health duplicate rides. Apple Health can hold one ride under two workout ids (one per writing app), which the same-provider external-id check and the cross-provider dedup both missed, so the weekly cardio tiles double counted (3 workouts / 57 Z2 min shown vs 2 / 33 real). New `findSameProviderCardioTwin` (apple_health only: start within 2 min, duration within 1 min, same sport family) runs in `upsertImported` before the cross-provider check; it keeps the stored row and copies distance onto it if only the twin has it (4 tests). Live cleanup: soft-deleted the 10/10 and 10/13 later copies, moved the 10/13 distance onto the kept row. Three older overlapping April-backfill pairs left alone (distances disagree). |
| 2026-10-17 | Zone 2 by power. Health Auto Export's workout `cyclingPower` series (Peloton writes it to Apple Health) now sets `avg_output` (time-weighted average watts) and credits Zone 2 minutes by the plan's power band (56-75% of FTP, `CURRENT_FTP_WATTS = 173` in `strain-sleep.ts`, 97-130 W); rides without power keep the heart rate band. In-batch twins keep the copy with power and borrow heart rate and distance from the other. `upsertImported` refreshes power on re-push, copies power and its Zone 2 onto a stored twin, and never replaces power-measured Zone 2 with a heart rate value. No migration (`avg_output` already existed). Unverified until the first ride after deploy: that Apple Health holds power for these rides and HAE has read access to Cycling Power. |
| 2026-10-17 | Ride fitness markers. New nullable `cardio_sessions` columns `best_5min_watts`, `best_20min_watts`, `zone2_heart_rate` (migration `20261017150000`). The Health Auto Export parser computes best rolling 5/20 min power and the median heart rate in the Zone 2 power band after a 10 min warm-up (10+ minutes needed); prefers non-Watch heart rate (a strap relayed by Peloton) over the Watch when both exist; lets a Peloton copy with only power borrow the Watch copy's heart rate series; records heart rate and power sources in the raw payload for diagnosis. Re-push and twin paths refresh or copy the new fields. Dashboard trend note compares median Zone 2 heart rate across 4-week windows (3+ rides each, 3 bpm threshold); cardio list shows avg watts, Z2 HR and best 5 min. Owner confirmed the bike is an original Peloton Bike (estimated power). |
| 2026-10-17 | Zone 2 by heart rate until FTP retest. Verified in production: Peloton power now reaches the app (owner turned on Peloton's Apple Health writes); today's ride stored 50 W vs Peloton's 51 W, and HR-band Zone 2 matched Peloton's zone time. FTP 173 predates the July injury, so `ZONE2_CREDIT_BY = "heart_rate"` (strain-sleep.ts) credits Zone 2 by the HR band with power as fallback; flip to "power" after the post-clearance retest. Twin path now refreshes Zone 2 and power markers from the power copy on every re-push (previously only the first copy, so a changed band never recomputed). |
| 2026-10-17 | PT 10/16 plan update and ride-tracking review fixes. Plan doc: PT progress note facts (flexion 126/130, extension 0, strength 4/5, plan of care 2-3x/week for 12-14 weeks), bike resistance and duration as tolerated, cadence-first progression, one change per ride, stay seated; weekday-evening ride HR runs well above Saturday at similar watts (strap would settle fatigue vs optical error). Review fixes: same-provider twin duration tolerance is now max(1 min, 10% of the longer ride), so a Peloton copy a few minutes shorter than the stored Watch copy no longer becomes a second row; best 5/20 min power above 2000 W is dropped instead of failing the ride's import; heart-rate Zone 2 mode has no power fallback and the HR band comes from the measured max HR without needing the profile lookup; the power copy clears stale best-power and Zone 2 HR values. Cardio templates to be set to 40/40/60 (live update pending owner approval of the database write). |
| 2026-10-17 | Readiness sleep curve. Short sleep below target now costs less: 15 min grace, last night 1 SD per 1.25 h, 7-night average 1 SD per 0.75 h, floored at -3. 7.3 h Sleep contributor 49 to 62; live replay of 10/17 score 59 to 62 (rest is HRV). New test pins the curve. |
| 2026-10-17 | Readiness: added "HRV, 7 nights" core component (7-night median ln HRV vs 30-day baseline). Weights HRV 0.30 / 7-night 0.10 / HR 0.20 / sleep 0.20 / sleep 7 nights 0.10 / wake 0.10. Live 10/17 score 62 to 63. Wrist temp stays a penalty. |
| 2026-10-18 | Readiness: overnight HR, HRV and breathing rate skipped on nights sleep started after 23:30 (fixed 23:00-05:59 window caught awake HR); core components capped at +/- 3 SD. Live 10/18 score 0 to 61. |
| 2026-10-18 | Overnight vitals averaged over actual sleep: HAE hourly points stored in `overnight_samples`, `OvernightMetricsService` recomputes each night over bedtime-to-wake (minute-weighted hourly buckets, readings preferred), `recovery_checkins.overnight_window` records sleep vs fixed; readiness late-bedtime guard now only for fixed rows. Migration `20261018170000`. |
| 2026-10-18 | Insights freshness: each run archives active rule insights that no longer fire (deleted_at left null, AI and dismissed untouched) and refreshes title/body/evidence of ones that still fire. Rule weeks, AI insight dates and the 7/14-day strength windows now use the profile timezone and weekStartsOn; strength windows end yesterday (no more Wednesday push/pull false alarm). No migration. |
| 2026-10-18 | Lift logger "Add weight" cue. Plan load rule (section 4): "hit the top of the rep range on all sets, then add weight next session". New pure helpers in `features/strength/helpers.ts`: `repRangeTop` ("8-12" -> 12, single numbers), `templateRepTop` (template `targetReps`, or the top of a range in the exercise notes that includes it, e.g. Lateral Raise 18 with "18-20" -> 20), `readyToAddLoad` (every working set last time at one logged weight reached the top; timed, distance, bodyweight, mixed weights or no target never qualify; no increment suggested). Loaded plan stores each exercise's rep top (kept in the draft); badge sits on the "Last" line. 8 new tests. No migration. |
| 2026-10-18 | Recovery page HRV (summary, trend, check-in list) shows overnight HRV, falling back to daily; daily `hrv` stopped being written once the HAE HRV export went hourly, which left it blank. |
| 2026-10-18 | Coaching text aligned to the plan doc: readiness calls follow bike progression rules (one change, hold on fair/low, never skip) and keep the knee block on low lift days; Sunday walk; weight insight no longer suggests a deficit (plan: rebuild +0.25-0.5 lb/wk, no cut); sleep insight anchors wake time instead of an earlier bedtime; lifts 3x/week; Zone 2 shortfall caps catch-up at +10%; RHR-up note says hold progression; fallback Zone 2 target 140. Strain uses measured max HR 192 (was age estimate). |
| 2026-10-19 | Wake target 5:30 (was 6:30), in bed 9:30-10 PM: sleep target 7.5 h asleep (was 8) for readiness and sleep need, lights-out floor 9:30 PM; plan doc section 7 and sleep insight copy updated. |
| 2026-10-19 | Wake target 6:00. Insights count logged lifts for weeks without a review (false "no strength in 2 weeks"). Readiness load penalty floors the 4-week average at the plan's weekly load (was -15 every day since lifts started). Weekly review in the More menu. |
| 2026-10-19 | Readiness v3 from a literature review: 7-night HRV median with a normal band (14-night baseline before HRV counts), overnight HR weighted equal to HRV, sleep debt over last night, vitals checked together (two up caps at fair), one-tap how-you-feel at 35%; training-load penalty and wake consistency removed. Late night of Oct 18 scores 54 (was 19); normal days 80. |
| 2026-10-19 | Post-op lower-body program: 6 program tables plus additive set/recovery/cardio columns (2 migrations, applied to live; PR #77), progression/readiness/gate engine with tests, dashboard Program card, `/program`, per-leg and isometric logging in the lift logger, Settings gates, cardio kJ. |
| 2026-10-19 | Phase A folded in before apply: settings table for all thresholds, explicit skips and red-flag stops, sleep lock on load increases, hold hides gated work, knee-off streak banner, walk-jog progression, upper rows in the program, gate earliest dates, ROM habit, run/walk minutes. |
| 2026-10-19 | Phase B: fuel fields on nutrition logs, weekly check-ins table, 23 settings; scorecard, streaks, execution/surplus/waist prompts on the dashboard; Sunday review with focus pick, trends and Copy summary; .ics calendar export. Migration applied to live; merged in PR #78. |
| 2026-10-19 | Strength templates updated in live data: leg block from the post-op program added ahead of the upper work in Mon/Wed/Fri, renamed to match the program sessions, notes say legs first. No code or migration. |
| 2026-10-19 | Program v1: schema migration (block activation, session/ride types, exercise library fields), engine rules (deload, target-RIR progression, holds, pull-up load cue, Find load, flagged quad counter, walk-jog stages), UI (warm-up, cues, rules), generated idempotent seed with self-checks; templates rebuilt; steps habit 8,000. |
| 2026-10-19 | Session 16. Mobile UX pass (PR #83, UI only): Program in the tab bar (Cardio to More), dashboard reordered readiness > program today > habits > week, compact tap-to-expand history on Cardio/Body/Strength, strength blank-workout gap fixed, nutrition fuel grid overflow fixed, 5x2 recovery pickers, Settings program targets fold closed. Verified at 390x844 on the preview. Open: production still public with no login (HTTP 200); Zone 2 target is 95 (template Z2 fields) vs 140 (ride lengths) vs 150 (Program v1). |
| 2026-10-20 | Session 17. Program v2 Phase A (owner brief replaces earlier prompts): supersets (schema + rest logic + labels), session time budget with the 60-min lift flag, walk-jog one stage per session, new-block load x1.1 per rep step, double progression for upper lifts, next-block header, accessory session type, v2 settings. Migration `20261020090000` applied to live with owner OK (in parts; plain UPDATE needs the UPDATE ... FROM form through the connector), then merged. |
| 2026-10-20 | Session 17, Phase B. Program v2 seed: generator `supabase/generators/program_v2.py` -> `20261020120000_seed_program_v2.sql` (14 blocks, 93 sessions, 340 exercises, supersets, Tue/Thu accessory circuits, shoulder-emphasis toggle as a settings-driven gate, gait drill setting, PT Tracker reminder on gates). Verified on a local Postgres replay of the live seed history: idempotent over three runs, logged rows untouched. Dry run through the app engine flags several lift days over 60 min by the spec formula. |
| 2026-10-19 | Session 18. Lift tracking reconciled and the dashboard decluttered (UI only, no migration). Program Today card and the /strength callout now read Done once a lift or ride is logged (Start lift, Skip, Red flag and warm-up go away; "Done · View" links the session). Dashboard "This week" is built from the program (was the old templates; Zone 2 target is now the sum of the week's Zone 2 ride lengths, 150 min in week 9, was 95). Dashboard card header is one line; scorecard and streaks moved to /program only; scorecard no longer paints an in-progress week red. Dry run of program v2 timing through the app's engine: weeks 9-13 run 38-61 min; later blocks reach 65-75 min (Wed in Block 3, Strength A, A2; Fri in Block 2 and A2) once gates clear, and Tue/Thu accessory blocks estimate 15-27 min vs a 10-12 label. Trims are the owner's call. |
