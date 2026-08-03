# Current State — FitnessApp

**Last updated:** 2026-08-02 (nutrition-target safety floor + estimate disclosure, strength-form accessibility labels)
**Overall health:** Stable. TypeScript clean. 244 tests pass. Lint clean. Production build succeeds. **All migrations through `20260722180000` have been applied to the live Supabase project** (done directly via the Supabase MCP connector this session — no more manual `supabase db push` step outstanding for those). Withings and Apple Health are live and verified. **Strava now requires a paid subscription to keep API access** (a Strava policy change, not something fixable in this codebase) — the user has chosen not to subscribe, so Strava is being retired as the cardio path in favor of Apple Health (see below). Peloton's unofficial API auth endpoint is also confirmed blocked by Peloton as of 2026-07-16 — direct Peloton sync is not viable either way.

This session ran a full product/UX/security/fitness-safety audit (see "What Was Done in This Session (2026-08-02, fitness-safety audit)" below), using parallel research passes over (a) strength/cardio unit conversion and progression logic and (b) security/auth/accessibility. Four concrete fixes shipped:

1. **Nutrition calorie/protein targets** (`NutritionTargetService`) computed BMR using hardcoded population-average age/height (and an implicit male BMR constant) behind a Settings button labeled "Recompute from my stats" — a real "unrealistic calorie estimate presented as personalized" gap called out explicitly in this session's brief. Fixed with a safe minimum-calorie floor (1200 kcal/day) and an in-UI disclosure of exactly what the estimate does and doesn't account for. Full personalization (adding age/height/sex fields) is scoped as TD-030 and deliberately deferred — it requires a schema migration this session chose not to apply to the live DB unsupervised.
2. **Estimated-1RM/top-set scoring** used an uncapped Epley-style formula, letting a light-weight, very-high-rep set outscore a genuine heavy top set and get flagged as a false personal record (TD-031) — capped the rep term used in the formula at 12.
3. **Recovery coaching suggestion** never looked at `sorenessLevel` despite it being collected for exactly this purpose, so severe DOMS alongside a normal readiness score produced no caution against heavy loading (TD-032) — added a soreness check ahead of the readiness checks.
4. **12 missing `aria-label`s** on inputs/selects in the strength logging, template-creation, and exercise-classification forms (TD-033) — the app's primary data-entry surfaces were relying on placeholder text alone for their accessible name.

The security/auth audit pass found no new issues (every server action still gates on `requireCurrentUser()` and scopes by session-derived `userId`; cron/webhook routes still verify correctly) — see the session log entry for the full checked-and-clean list.

This session's audit found the app's integration/data-integrity layer (auth, OAuth token encryption, RLS, per-provider dedup, webhook signature verification) in solid shape, but the product's stated #1 goal — knowing whether you're neglecting a muscle group — had zero supporting code anywhere. That was the highest-value gap and is now closed end-to-end: an exercise catalog with muscle-group/movement-pattern tagging, a volume aggregation service, a "not trained this week" dashboard callout, a muscle-group balance card on `/strength`, and 4 new coaching-insight rules (muscle-group neglect, push/pull imbalance, deload suggestion, consistently-exceeding-cardio-target). Since then: timed/distance set logging, login rate limiting, account deletion + data export, user-editable exercise catalog overrides (TD-021), numeric goal targets + training-plan day-of-week scheduling (TD-027), a fix for a completely broken strength-template-creation flow (TD-028), a new Apple Health workout webhook (TD-029) so Peloton rides can sync for free once Strava's paid tier made that path unattractive, and (this session) a caller-controlled `limit` on every `listByDateRange` query (TD-016), closing out the tech-debt register down to a single conditional item (TD-019). See "What Was Done in This Session (2026-07-25, listByDateRange limit)" below.

---

## Health Summary

| Dimension    | Status  | Notes                                                                                                                                                                                                                                                                                              |
| ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript   | CLEAN   | Zero errors across all 6 packages                                                                                                                                                                                                                                                                  |
| Lint         | CLEAN   | No warnings                                                                                                                                                                                                                                                                                        |
| Tests        | PASSING | 257/257 (47 web, 164 application, 14 integrations, 32 jobs)                                                                                                                                                                                                                                        |
| Build        | PASSING | `pnpm build` succeeds without a live `.env.local` — all data-dependent routes are dynamic, so no Supabase connectivity is needed at build time                                                                                                                                                     |
| E2E          | READY   | Playwright configured, 6 spec files (auth, navigation, body, cardio, integrations, weekly-review)                                                                                                                                                                                                  |
| Database     | LIVE    | Cloud Supabase project, credentials in .env.local                                                                                                                                                                                                                                                  |
| Integrations | PARTIAL | Withings and Apple Health live and verified (Apple Health now also syncs individual workouts, not just sleep/daily-activity). Strava requires a paid subscription the user has declined — being retired as the cardio path. Peloton direct sync confirmed blocked by Peloton's own API as of 2026-07-16. Free path forward: Peloton (once the user's meniscus injury heals) writes rides to Apple Health, which syncs into `cardio_sessions` via the new `/api/integrations/apple-health/workouts` webhook. |

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
| Strength      | `/strength`, `/strength/[id]` | Complete, plus muscle-group/movement-pattern volume tracking, warm-up marking, timed/distance set logging, user-editable exercise catalog overrides, and template day-of-week scheduling with a "Today's plan" callout (2026-07-22)                     | A `failure` flag still isn't wired to the UI — no rest timer or superset grouping                                                                                                                                                                       |
| Recovery      | `/recovery`                   | Complete                                                                                                                                       | None                                                                                                                                                                                                                                                                                             |
| Body          | `/body`                       | Complete                                                                                                                                       | None                                                                                                                                                                                                                                                                                             |
| Nutrition     | `/nutrition`                  | Complete                                                                                                                                       | None                                                                                                                                                                                                                                                                                             |
| Weekly Review | `/weekly-review`              | Complete — includes weekly auto-draft cron                                                                                                     | No AI-generated narrative yet (score/why/what-worked/etc.) — only a rule-based numeric summary is auto-filled                                                                                                                                                                                    |
| Journal       | `/journal`                    | Complete — weekly cron also auto-drafts a reflection entry                                                                                     | None                                                                                                                                                                                                                                                                                             |
| Insights      | `/insights`                   | Complete — rule-based engine **plus** optional AI-generated insights (Claude API) when `ANTHROPIC_API_KEY` + `INSIGHT_AI_ENABLED=true` are set | AI insights are a distinct feature from an AI _weekly review_; no weekly-review-format AI output exists yet                                                                                                                                                                                      |
| Settings      | `/settings`                   | Complete, plus a Danger Zone (data export + account deletion, 2026-07-22) and a numeric target weight/date under Training Goals (2026-07-22)                                                                      | None                                                                                                                                                                                                                                                                                             |
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
4. **Nutrition calorie/protein targets don't account for age, height, or sex** (TD-030) — see `TECH_DEBT.md` Priority 1. Partially mitigated this session (safety floor + UI disclosure); full fix needs a schema migration.

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

1. User: set a target weight/date under Settings → Training Goals, and create/pin your M/W/F strength templates with a scheduled day under `/strength` (adjusted for your current meniscus injury as needed) — the underlying capability (TD-027) is built and the migration is live, but the actual numbers/templates are personal data this container has no way to enter on your behalf
2. User: once you're back to riding, set up a bridge app (e.g. Health Auto Export) to POST workout data to `/api/integrations/apple-health/workouts` — see `docs/integrations/apple-health-bridge-setup.md` for the exact payload shape. This is now the recommended free cardio-sync path since Strava requires a paid subscription.
3. Cross-provider duplicate detection + source-priority rules for cardio/body metrics (TD-019) — re-escalated to a real (if not currently active) risk now that Apple Health syncs cardio workouts too; prioritize this before ever reconnecting Strava/Peloton direct sync alongside Apple Health workout sync
4. Consider whether to keep the Strava/Peloton-direct code paths at all now that neither is realistically usable (Strava paywalled, Peloton API blocked) — not urgent, but worth a decision at some point rather than carrying unused integration surface indefinitely

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

## What Was Done in This Session (2026-07-22, goal targets + training-plan scheduling)

With the tech-debt register nearly drained, moved to the highest-value remaining product gap: `profiles` only had 3 boolean goal flags (no numeric targets), and `TrainingTemplate` had no day-of-week concept — a template was just a flat exercise list the user had to manually re-pick every session.

1. **Numeric fat-loss target** — `targetWeightLb`/`targetDate` added to the profile (migration `20260722180000`, applied to the live project as of 2026-07-25 — see note above), editable under Settings → Training Goals. The dashboard's fat-loss goal card now shows real progress-to-target ("14.0lb to go — on pace for 2027-03-01") and an at/below-target state when a target is set, falling back to the previous trend-only heuristic when it isn't — fully backward compatible for users who never set a target.
2. **Template day-of-week scheduling** — `TrainingTemplate.scheduledDayOfWeek` (0=Sunday..6=Saturday, matching JS `Date#getDay()`), settable at creation or changed anytime via an inline dropdown on each template row. `/strength` now computes today's day-of-week in the user's own timezone (`getZonedDate()`) and shows a "Today's plan" callout with a one-click "Load into form" when a template is scheduled for today — no more manually hunting for the right template every session.
3. **Fixed a completely broken strength-template-creation flow (TD-028), found while touching this exact code path**: the web-layer validation schema used by `createStrengthTemplateAction` expected fields named `name/sets/reps/rpe/notes`, but the actual create-template form always sent `exerciseName/exerciseOrder/targetSets/targetReps/targetWeight/targetRir/notes` — every template creation via the UI was silently failing validation with "Invalid exercise data." Fixed by removing the mismatched schema and validating against the correct, already-canonical `strengthTemplateExerciseSchema` from `@fitness-app/application` (the same schema the service layer parses downstream anyway).
4. 11 new tests (settings-form target weight/date parsing, `createStrengthTemplateSchema`/`setTemplateScheduleSchema` validation, and a regression test pinning down the exact payload shape the create-template form sends) — 228 total, up from 217.

---

## What Was Done in This Session (2026-07-25, Apple Health workout sync — free Peloton/cardio path)

Context: Strava changed its API policy to subscriber-only, and the user declined to pay for it. Separately, the user tore their meniscus, so Peloton riding is paused for a while. Rather than build anything Peloton-specific (which won't get used for a bit), built a provider-agnostic path that works for Peloton *and* anything else that writes to Apple Health, so it's ready whenever cycling resumes.

1. **Applied all 3 previously-pending migrations directly to the live Supabase project** via the Supabase MCP connector available in this session (`create_auth_rate_limit_attempts`, `create_exercise_muscle_group_overrides`, `add_target_weight_and_template_schedule`) — these had been sitting merged-but-not-applied since PRs #12/#14/#15. Verified via `list_migrations` and a security-advisor check (no new issues beyond the by-design `auth_rate_limit_attempts` RLS-no-policy, which is intentional — service-role only).
2. **New Apple Health workout webhook** (`POST /api/integrations/apple-health/workouts`, `AppleHealthWorkoutSyncOrchestrator`) — ingests individual completed workout sessions (not date-keyed daily aggregates like the existing sleep/daily-metrics endpoints) and maps them into `cardio_sessions`, deduped by `(source_provider, source_external_id)` via the existing `CardioSessionService.upsertImported()` — the same target-table dedup Strava/Peloton already use. Same auth scheme (per-user bearer token or HMAC) as the existing two Apple Health endpoints, reusing `verify-request.ts` unchanged.
3. **Why this matters**: the Peloton app can write completed rides straight to Apple Health automatically. A bridge app (Health Auto Export or similar) already used for sleep/daily-metrics can now also export "Workouts" data to this new endpoint — so Peloton rides sync for free, with no Strava dependency and no per-API-vendor code. Works for any activity type that lands in Apple Health, not just Peloton.
4. **`docs/integrations/apple-health-bridge-setup.md` updated** with the full payload shape, field table, and a note on why session_kind defaults to `"zone2"` (right for steady-state cardio) with an explicit override for interval/recovery work.
5. **TD-019 re-escalated**: the previous downgrade to "forward-looking, no live trigger path" was conditioned on Apple Health not syncing cardio data. That's no longer true — if Strava or Peloton direct sync is ever reconnected while Apple Health workout sync is active, the same ride could double-count. Not an active bug today (Strava's paywalled, Peloton's blocked, so Apple Health is the only live cardio path), but flagged as a real risk to resolve before reconnecting either.
6. 4 new tests (`AppleHealthWorkoutSyncOrchestrator`: payload mapping, duration derivation from start/end, explicit `session_kind` override, per-item failure handling) — 232 total, up from 228.

---

## What Was Done in This Session (2026-07-25, listByDateRange caller-controlled limit — TD-016 closed)

With the register down to two low-priority items, closed the last concrete one: `listByDateRange` was hardcoded to a 500-row cap across all 7 infrastructure repositories that have it, silently truncating a power user's results once they crossed that threshold in a queried date range.

1. **Added an optional `limit` field to the shared `dateRangeQuerySchema`** (`packages/application/src/shared/primitives.ts`) — capped at 2000, so every module's `*DateRangeQuery` type picked it up automatically since they all alias this one schema. A new `DEFAULT_DATE_RANGE_QUERY_LIMIT` constant (500) preserves the exact previous behavior for every existing caller that doesn't pass one.
2. **Every repository's `listByDateRange` now uses `query.limit ?? DEFAULT_DATE_RANGE_QUERY_LIMIT`** instead of a bare `.limit(500)` — body metrics, cardio sessions, daily activity metrics, journal entries, nutrition logs, recovery checkins, strength sessions, and supplement logs.
3. Deliberately did **not** change any server.ts call site to pass an explicit limit — nothing today actually needs more than 500 rows in a date range, so this is forward-looking infrastructure (the interface now supports it) rather than a behavior change. A future "view all history" feature or similar can now ask for more without a repository-layer change.
4. 4 new tests (`dateRangeQuerySchema` limit: default/undefined when omitted, accepts above the old 500 cap, rejects non-positive, rejects above the 2000 ceiling) — 236 total, up from 232.

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

---

## What Was Done in This Session (2026-08-02, fitness-safety audit)

Full product/UX/QA/security/fitness-safety audit per an explicit multi-perspective audit brief (senior product engineer, UX designer, QA lead, security reviewer, fitness-domain safety reviewer). Verified the baseline first (typecheck/lint/test/build all clean, 236/236 tests, matching the docs), then read every prior session's doc trail to avoid re-litigating already-resolved issues, then ran two parallel research passes: (1) strength/cardio unit conversion, 1RM estimation, and progression-safety logic, and (2) security/auth on every action/route added since the muscle-group-tracking era, plus accessibility on the newer strength/settings components. Findings and fixes:

1. **TD-030 (partial fix) — Nutrition calorie/protein targets ignore age, height, sex.** `NutritionTargetService.computeNutritionTargets()` substitutes hardcoded population defaults (30yo, 170cm, implicit male BMR constant) for the real inputs the profile doesn't collect, yet the Settings UI calls the button "Recompute from my stats." Added: a `MIN_SAFE_DAILY_CALORIES` (1200 kcal/day) floor so the fat-loss deficit heuristic can never recommend an unsafely low target, and a `notes: string[]` field on `NutritionTargets` (always includes a "rough estimate, not personalized/medical" disclosure; adds a "no logged body weight" note when the weight input itself was defaulted; adds a safety-floor note when the floor was applied) rendered directly under the Recompute button in Settings, plus a "not medical advice, talk to a doctor/dietitian" line. Full personalization (add age/height/sex fields) is deferred as TD-030 since it needs a schema migration — this session did not apply schema changes to the live Supabase project without the user present to verify. 8 new tests.
2. **TD-031 — False personal-record badges from an uncapped 1RM estimate formula.** `strength-progression.ts`'s `setScore()` used `weight * (1 + reps/30)` with no rep cap; since the formula's accuracy already breaks down well past ~12 reps, a light weight at very high reps (e.g. 60lb × 100) could outscore a genuine heavy top set (185lb × 5) and get flagged as a PR — an "inappropriate progression" signal the audit brief specifically called out as a risk category. Capped the reps used inside the formula at 12 (`MAX_REPS_FOR_ONE_REP_MAX_ESTIMATE`); the actually-logged rep count is untouched everywhere else (volume math, set history display). Zero test coverage existed for this file before this session; added a new `strength-progression.test.ts` with 5 tests including the exact false-PR regression scenario.
3. **TD-032 — Recovery coaching ignored soreness.** `getRecoveryCoachingSuggestion()` (the one place in the app that actively tells the user whether to train hard or back off today) checked `readinessLevel` and `hrv` but never `sorenessLevel`, despite soreness being collected in the same check-in form for exactly this purpose — a user could report severe DOMS (`sorenessLevel: 9`) with a normal readiness score and get no caution. Added a soreness check (`>= 8` triggers a warning), evaluated *before* the readiness checks so it can't be masked by an otherwise-fine readiness score. Zero test coverage existed for this function before this session; 4 new tests.
4. **TD-033 — Accessibility: 12 unlabeled inputs/selects on the primary data-entry forms.** The strength quick-logging form, template-creation form, template day-of-week scheduler, and exercise-classification card all relied on placeholder text alone (no `aria-label`/`label htmlFor`) for fields including exercise name, sets, reps, weight, RIR, duration, distance, and set/exercise notes — placeholder text is not a reliable accessible name for assistive tech, and these are the app's busiest data-entry surfaces. Added `aria-label` to all 12 fields.
5. **Security/auth: no new issues found.** Every server action added since the muscle-group-tracking era (strength template scheduling, exercise overrides, settings goal targets, account export/delete) still calls `requireCurrentUser()` and derives `userId` from the session, never from client input; repository writes still filter by `user_id` independently of RLS; cron routes still gate on a constant-time `CRON_SECRET` check; Apple Health webhook auth is still scoped per-user (not a shared secret); `/api/account/export` still can't be tricked into returning another user's data and doesn't log payload contents; no client-side `console.*` calls carrying PII were found.
6. 253 tests total (up from 236) — `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all verified clean after every change. `pnpm format` was checked separately and found **203 pre-existing files with Prettier drift unrelated to this session's changes** (confirmed via `git stash` before/after comparison) — noted as a baseline finding, not fixed (out of scope: touching 203 unrelated files is exactly the kind of unrelated-file sweep this project's conventions warn against). This session's own changed files are Prettier-clean.

PR #18 merged to `main`. Vercel preview build verified green before merge.

**Follow-up (same day, TD-034):** picked up the remaining lower-priority item flagged by the strength/cardio research pass but deferred from the first PR — strength set `weight`/`reps` and template `targetWeight` had no upper bound at any layer, unlike sibling fields (`rir`, `readinessPre`, `targetReps`) on the exact same schemas. A fat-fingered `weight: 99999` or `reps: 100000` would pass every layer (client zod, application zod, DB) untouched, silently corrupting PR detection, volume math, and progression trends. Added generous data-entry sanity bounds — weight ≤ 2000lb, reps ≤ 1000 — at both the client form schema and the two application-layer schemas (`strength-session.ts`, `training-template.ts`); bounds are set well above any realistic single-set value (loaded machines can legitimately exceed 1000lb; extreme AMRAP sets can exceed 100 reps) so no genuine log entry is ever rejected. 4 new tests (257 total, up from 253). PR #19 merged.

**Follow-up 2 (same day, TD-035):** audited the two LLM-backed coaching features next, since neither had been covered by the earlier fitness-safety pass. `AiInsightService` and `AiWeeklyReviewService` sent Anthropic API prompts with **zero safety constraints** — no instruction against diagnosing a condition, prescribing a specific calorie/training/supplement value, or using alarmist/guilt language, which directly contradicts this project's own stated principle to treat health guidance as sensitive. Separately, `/insights` rendered AI-sourced and rule-based insights with identical styling: `PersistedInsight.sourceKind` (`"rule" | "ai"`) was already tracked in the schema and covered by orchestrator tests, but the `InsightCard` component never read it, so a user had no way to know which insights came from a deterministic, auditable rule versus unconstrained LLM output. Fixed: added explicit no-diagnosis / no-prescription / no-guilt-language / ground-in-the-provided-data rules to both prompts, added a small "AI" badge (with an explanatory tooltip) to AI-sourced insight cards, and a page-level disclaimer on `/insights`. The weekly-review AI draft panel (`AiWeeklyReviewDraft`) was already well-labeled ("AI draft — awaiting your review," "informational only," requires an explicit accept action before anything is saved) — confirmed no change needed there. No new tests: this change is prompt copy (not independently testable beyond the existing response-parsing tests, which still pass) and a UI label (this repo has no component-testing infra — verified via typecheck/lint/build instead, consistent with prior UI-only changes this session).
