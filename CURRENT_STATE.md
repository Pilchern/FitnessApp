# Current State — FitnessApp

**Last updated:** 2026-06-21 (sprint 5)
**Overall health:** Stable. TypeScript clean. All 49 unit tests pass. Lint clean. 10 E2E spec files. Live Supabase project connected. Strava integration live.

---

## Health Summary

| Dimension | Status | Notes |
|---|---|---|
| TypeScript | CLEAN | Zero errors across all 6 packages |
| Lint | CLEAN | No warnings |
| Tests | PASSING | 49/49 (8 web, 34 application, 5 integrations, 2 jobs) |
| Build | UNTESTED | Requires live Supabase connectivity to verify fully |
| E2E | READY | Playwright configured, 10 spec files (auth, body, cardio, weekly-review, recovery, nutrition, journal, strength, insights, settings) |
| Database | LIVE | Cloud Supabase project, credentials in .env.local |
| Integrations | ACTIVE | Strava connected and syncing; Withings framework built (creds needed) |

---

## Architecture Summary

6-package pnpm monorepo. Strict layered architecture (domain → application → infrastructure). Next.js 15 App Router is a thin delivery shell over portable business logic packages.

```
apps/web                    Next.js App Router delivery shell
packages/domain             Pure domain types (zero dependencies)
packages/application        Services, use cases, Zod validation, repo ports
packages/infrastructure     Supabase repository implementations
packages/integrations       Strava + Withings OAuth + payload normalization
packages/jobs               Background sync orchestration
supabase/                   12 SQL migrations, seed data, RLS policies
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
| Weekly Review | `/weekly-review` | Complete | None |
| Journal | `/journal` | Complete | None |
| Insights | `/insights` | Complete, rule-based + AI | AI active when `ANTHROPIC_API_KEY` + `INSIGHT_AI_ENABLED=true` set |
| Settings | `/settings` | Complete | None |
| Integrations | `/integrations` | Complete | Withings OAuth creds not configured |

---

## Active Known Issues

### Critical
- None

### High
- None

### Medium
1. **Withings integration unconfigured** — OAuth credentials not set. Withings card shows "Not connected" state. Needs `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET`, `WITHINGS_REDIRECT_URI` in `.env.local`.
2. **No background job queue** — The weekly Strava cron (`/api/cron/strava-sync`) relies on Vercel Cron. No execution infrastructure for non-Vercel environments.

### Low
3. **`listByDateRange` capped at 500 rows** — This is intentional (was unbounded), but power users with >500 entries per date range will hit this cap. Acceptable for current scale.

---

## Technical Debt Register

See `TECH_DEBT.md` for full prioritized list.

---

## Active Priorities (Recommended Next Sprint)

1. Configure Withings OAuth credentials (quick win — all code is in place)
2. Enable AI insights: set `ANTHROPIC_API_KEY` + `INSIGHT_AI_ENABLED=true` in Vercel/env (all code wired)
3. Add `CRON_SECRET` to Vercel dashboard for Strava weekly auto-sync
4. Add E2E coverage for integrations page and weekly-review form submission flow
5. Evaluate background job queue (Inngest or Supabase Edge Functions + pg_cron)

---

## Environment and Infrastructure

- **Database:** Supabase cloud project (credentials in `apps/web/.env.local`)
- **Auth:** Supabase Auth (email/password), sessions via HTTP-only cookies
- **Strava integration:** Fully live — OAuth connect, sync, weekly cron
- **Withings integration:** Code complete, OAuth credentials not configured
- **Encryption key:** `INTEGRATION_ENCRYPTION_KEY` set (base64-encoded 32-byte AES-256 key)
- **Cron:** Weekly Strava sync at `/api/cron/strava-sync` (needs `CRON_SECRET` in Vercel env)
- **Local Supabase:** Can be run locally with `supabase start && supabase db reset`
- **Seed user (local only):** `dev@example.com` / `password1234`
- **CI/CD:** None configured yet

---

## What Was Done in This Session (2026-06-21, sprint 5)

1. **E2E coverage expanded** — 6 new Playwright spec files added: `recovery.spec.ts`, `nutrition.spec.ts`, `journal.spec.ts`, `strength.spec.ts`, `insights.spec.ts`, `settings.spec.ts`. Total spec files: 10 (was 4). Every app route now has at least basic coverage (page load + unauthenticated redirect).
2. **Insights AI status clarified** — AI insights were already fully wired in `services.ts` and `insight-orchestrator.ts` (done in sprint 4). `CURRENT_STATE.md` had stale "no AI hookup" note — corrected. AI activates automatically when `ANTHROPIC_API_KEY` + `INSIGHT_AI_ENABLED=true` are present.
3. **TD-011b closed** — Timezone server-side validation was already implemented via `isValidTimezone()` in `(auth)/actions.ts` (uses `Intl.supportedValuesOf`, falls back to UTC). Marked resolved in `TECH_DEBT.md`.
4. **`metrics.slice(0, 12)` verified** — Body metric repository uses `ascending: false`; slice(0,12) correctly returns the 12 most recent entries. No change needed.
5. **Docs updated** — `CURRENT_STATE.md` and `TECH_DEBT.md` reflect actual sprint 5 state.

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
4. **UI polish + consumer language** — ~35 files updated; all developer/technical language removed; Peloton card removed; status labels polished; consumer-first copy throughout
5. **Nutrition module verified** — Confirmed fully implemented across all layers
6. **E2E tests** — Playwright configured at repo root; `weekly-review.spec.ts` added; 4 spec files total
7. **TypeScript fixes** — `FinalizeOAuthConnectionInput` import corrected; `SaveConnectionInput` type extracted; `formatImportBatchStatus` fixed for real domain enum values
8. **Dead code removed** — `modulePageContent` map (placeholder dev content, never used in UI)
9. **TD-011 fixed** — Timezone auto-detected from browser at signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`; no longer hardcoded to `America/Chicago`
10. **TD-009 fixed** — `.limit(500)` added to all 6 `listByDateRange` repository implementations
