# Current State — FitnessApp

**Last updated:** 2026-04-05 (sprint 3)
**Overall health:** Stable. TypeScript clean. All 49 tests pass. Lint clean. Live Supabase project connected. Strava integration live.

---

## Health Summary

| Dimension | Status | Notes |
|---|---|---|
| TypeScript | CLEAN | Zero errors across all 6 packages |
| Lint | CLEAN | No warnings |
| Tests | PASSING | 49/49 (8 web, 34 application, 5 integrations, 2 jobs) |
| Build | UNTESTED | Requires live Supabase connectivity to verify fully |
| E2E | READY | Playwright configured, 4 spec files (auth, body, cardio, weekly-review) |
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
| Insights | `/insights` | Complete, rule-based | No AI hookup yet |
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
3. **Insights are rule-based only** — No AI hookup. Configured in `packages/application/src/modules/insights/`.

### Low
4. **`metrics.slice(0, 12)` in body server.ts** — Verify sort direction returns the 12 most recent entries for charts.
5. **`listByDateRange` capped at 500 rows** — This is intentional (was unbounded), but power users with >500 entries per date range will hit this cap. Acceptable for current scale.

---

## Technical Debt Register

See `TECH_DEBT.md` for full prioritized list.

---

## Active Priorities (Recommended Next Sprint)

1. Configure Withings OAuth credentials (quick win — all code is in place)
2. Wire AI into Insights module (high value feature)
3. Write more E2E test coverage (navigation, integrations, weekly-review form submission)
4. Add `CRON_SECRET` to Vercel dashboard for Strava weekly auto-sync
5. Performance: verify `metrics.slice(0, 12)` sort order in body server

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
