# Current State — FitnessApp

**Last updated:** 2026-07-15 (docs reality audit)
**Overall health:** Stable. TypeScript clean. 146 tests pass. Lint clean. Live Supabase project connected. Withings and Apple Health are live and verified. Strava is currently broken (app deactivated on Strava's side — user action required). Peloton's unofficial API auth endpoint is confirmed blocked by Peloton as of 2026-07-16 — direct Peloton sync is not currently viable; **Peloton → Strava relay (via Peloton's own "auto-export to Strava" setting) is now the recommended cardio path**, pending Strava reactivation.

---

## Health Summary

| Dimension | Status | Notes |
|---|---|---|
| TypeScript | CLEAN | Zero errors across all 6 packages |
| Lint | CLEAN | No warnings |
| Tests | PASSING | 86/86 (17 web, 60 application, 7 integrations, 2 jobs) |
| Build | UNTESTED | Requires live Supabase connectivity to verify fully |
| E2E | READY | Playwright configured, 4 spec files (auth, body, cardio, weekly-review) |
| Database | LIVE | Cloud Supabase project, credentials in .env.local |
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
supabase/                   20 SQL migrations, seed data, RLS policies
```

---

## Module Status

| Module | Route | Implementation | Known Issues |
|---|---|---|---|
| Dashboard | `/dashboard` | Complete | None |
| Cardio | `/cardio` | Complete | None |
| Strength | `/strength`, `/strength/[id]` | Complete | None |
| Recovery | `/recovery` | Complete | None |
| Body | `/body` | Complete | None |
| Nutrition | `/nutrition` | Complete | None |
| Weekly Review | `/weekly-review` | Complete — includes weekly auto-draft cron | No AI-generated narrative yet (score/why/what-worked/etc.) — only a rule-based numeric summary is auto-filled |
| Journal | `/journal` | Complete — weekly cron also auto-drafts a reflection entry | None |
| Insights | `/insights` | Complete — rule-based engine **plus** optional AI-generated insights (Claude API) when `ANTHROPIC_API_KEY` + `INSIGHT_AI_ENABLED=true` are set | AI insights are a distinct feature from an AI *weekly review*; no weekly-review-format AI output exists yet |
| Settings | `/settings` | Complete | None |
| Integrations | `/integrations` | Complete UI for all 4 providers (Withings, Strava, Peloton, Apple Health) | Withings and Peloton need credentials; Apple Health needs `APPLE_HEALTH_WEBHOOK_SECRET` |

---

## Integrations — Actual State (corrected 2026-07-15)

Prior versions of this doc said only Strava and Withings existed. That was wrong. Four provider integrations exist in code today:

| Provider | Type | Code location | Cron/sync | Configured? |
|---|---|---|---|---|
| Strava | OAuth 2.0 | `packages/integrations/src/providers/strava/` | `/api/cron/strava-sync` (weekly, in `vercel.json`) | Yes — live |
| Withings | OAuth 2.0 | `packages/integrations/src/providers/withings/` | Manual sync via UI; no dedicated cron | No — `WITHINGS_CLIENT_ID/SECRET/REDIRECT_URI` unset |
| Peloton | Username/password against Peloton's unofficial API (no public API exists) | `packages/integrations/src/providers/peloton/peloton-adapter.ts` | `/api/cron/peloton-sync` (weekly, in `vercel.json`) | **Blocked at the source.** Confirmed 2026-07-16: `POST https://api.onepeloton.com/auth/login` returns `403 Access forbidden. Endpoint no longer accepting requests.` for any credentials — Peloton has deliberately restricted third-party auth to this endpoint. Not a code bug; not fixable without reverse-engineering around a deliberate access restriction, which this project won't do. The adapter/cron/UI remain in place in case Peloton's policy changes, but the recommended path is Peloton's own "auto-export to Strava" setting instead. |
| Apple Health | HMAC-signed webhook (sleep only today) | `apps/web/src/app/api/integrations/apple-health/sleep/route.ts` + `packages/jobs/src/orchestration/apple-health-sleep-sync.ts` | Push-based (bridge app posts on a schedule), no cron | No — `APPLE_HEALTH_WEBHOOK_SECRET` unset |

The Peloton adapter maps `avgOutput` (watts, derived from `total_output`), `cadenceMin`/`cadenceMax`, and `resistanceMin`/`resistanceMax`. The Strava adapter only maps `avgOutput` and `cadenceMin` (from `average_watts`/`average_cadence`) — `cadenceMax`, `resistanceMin`, and `resistanceMax` are always `null` via Strava, because Strava's activity model has no equivalent fields. Direct Peloton sync would be strictly higher-fidelity for cycling metrics than a Peloton→Strava→FitnessApp path — **but this is now moot**: Peloton's unofficial API auth endpoint is confirmed blocked (see the Peloton row above), so the only remaining automated path is the Strava relay, accepting the fidelity loss. A full-fidelity alternative — importing Peloton's own CSV workout-history export — was considered and rejected for now (would require building a new CSV import path; not started) in favor of the zero-code Strava relay. Revisit if the fidelity loss becomes a real pain point.

### Scheduled jobs (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/peloton-sync", "schedule": "0 8 * * 1" },
    { "path": "/api/cron/strava-sync", "schedule": "0 8 * * 1" },
    { "path": "/api/cron/weekly-review-auto-finalize", "schedule": "0 8 * * 1" }
  ]
}
```

A fourth cron route exists at `/api/cron/insights-generate` (generates rule-based + AI insights for every profile) but is **not** registered in `vercel.json` — it currently only runs if triggered manually or by an external scheduler. See TECH_DEBT.md TD-017.

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
3. **`insights-generate` cron not scheduled** — route exists and works, but is missing from `vercel.json`. AI/rule-based insights only regenerate on manual trigger. (TD-017)

### Low
4. **`metrics.slice(0, 12)` in body server.ts** — Verify sort direction returns the 12 most recent entries for charts.
5. **`listByDateRange` capped at 500 rows** — This is intentional (was unbounded), but power users with >500 entries per date range will hit this cap. Acceptable for current scale.

### Resolved this session
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
3. Revisit CSV import from Peloton's own workout-history export if the Strava-relay fidelity loss (no cadence-max/resistance) becomes a real pain point (not started — would be new code)
4. Schema additions: waist_hip_in/waist_gut_in, bedtime/wake time, cold plunge, supplement adherence
5. Background job infrastructure with real retry/dead-letter handling (TD-014)
6. AI-powered weekly review narrative, built as an editable draft
7. Schedule `insights-generate` in `vercel.json` (or fold into the job-infra work in item 5)

---

## What Was Done in This Session (2026-07-15, docs reality audit)

Full repo grep for every integration provider, API route, job orchestrator, and cron actually present in code, cross-checked against `CURRENT_STATE.md`/`FitnessAppContext.md`. Found and corrected drift:
- Peloton adapter, connect route, weekly cron, and UI integration card exist and were undocumented (docs said only Strava + Withings).
- Apple Health sleep webhook (HMAC-signed) + orchestrator exist and were undocumented.
- `AiInsightService` already makes real Anthropic API calls for the Insights module — docs said "rule-based only, no AI hookup yet." (Still true that no *weekly-review-format* AI narrative exists.)
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
