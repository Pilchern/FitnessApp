# FitnessApp — Living Context Document

> This file is the canonical reference for ongoing Claude Code work on this app.
> Update it as the app evolves. It is used to orient any new agent or session.

---

## What This App Is

A personal health, fitness, recovery, and body-composition tracking app built for one primary user (performance-minded athlete). It is **manual-first** (you can log everything without any integrations) and **provider-optional** (Withings body metrics can be imported; more providers are planned).

The app is not a calorie counter or social fitness platform. It is a weekly coaching loop: log training, recovery, and body data → run a weekly review → get rule-based insights → adjust next week.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Monorepo manager | pnpm 10 workspaces |
| Language | TypeScript 5.7 (strict) |
| Frontend framework | Next.js 15 (App Router, React 19) |
| Styling | Tailwind CSS 3.4 |
| Database | Supabase / PostgreSQL |
| Auth | Supabase Auth (email/password) |
| ORM / DB client | Supabase JS SDK |
| Validation | Zod 3 |
| Testing | Vitest 2 |
| Lint | ESLint (next/core-web-vitals + prettier) |
| Format | Prettier 3 |

---

## Monorepo Structure

```
apps/
  web/             → Next.js 15 App Router delivery shell
packages/
  domain/          → Pure domain types, zero dependencies
  application/     → Use cases, services, repository ports, DTOs
  infrastructure/  → Supabase repository implementations
  integrations/    → Withings OAuth + payload normalization
  jobs/            → Background sync orchestration
supabase/
  migrations/      → 11 SQL migration files
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

| File | Purpose |
|---|---|
| `apps/web/src/middleware.ts` | Route protection, auth redirects |
| `apps/web/src/app/(auth)/actions.ts` | Login, signup, logout server actions |
| `apps/web/src/app/(protected)/layout.tsx` | Protected shell with nav and profile bootstrap |
| `apps/web/src/lib/server/profile-bootstrap.ts` | Creates default profile on first login |
| `apps/web/src/lib/auth.ts` | `sanitizeRedirectTo`, `mapAuthErrorMessage` |
| `apps/web/src/lib/navigation.ts` | All route definitions + module metadata |
| `packages/application/src/index.ts` | All exported services, schemas, helpers |
| `packages/infrastructure/src/index.ts` | All exported repositories |
| `supabase/migrations/` | Ground truth for DB schema |

---

## Feature Module Status

| Module | Route | Status |
|---|---|---|
| Dashboard | `/dashboard` | Implemented — 6 parallel queries, basic cards |
| Cardio | `/cardio` | Implemented — Zone2/VO2/recovery/other, full CRUD |
| Strength | `/strength` | Implemented — Sessions + sets, RPE/RIR tracking |
| Recovery | `/recovery` | Implemented — RHR, HRV, sleep, readiness |
| Body | `/body` | Implemented — Weight/waist/body fat, trends |
| Weekly Review | `/weekly-review` | Implemented — Scoring engine, reflection fields |
| Journal | `/journal` | Implemented — Tags, search, weekly-review links |
| Insights | `/insights` | Implemented — Rule-based engine, dismiss/archive |
| Settings | `/settings` | Implemented — Profile, timezone, units, goals |
| Integrations | `/integrations` | Implemented — Withings OAuth, sync status |
| Nutrition | `/nutrition` | Implemented — Daily log, macro tracking, CRUD |

---

## Database Tables (Quick Reference)

**Core tracking tables:**
`profiles`, `training_templates`, `cardio_sessions`, `strength_sessions`, `strength_exercise_sets`, `recovery_checkins`, `body_metrics`, `nutrition_logs`, `weekly_reviews`, `journal_entries`, `insights`

**Integration audit tables:**
`integration_connections`, `integration_credentials`, `import_batches`, `raw_import_events`, `sync_job_runs`

All tables have RLS enabled with user-scoped policies. Every row is scoped to `user_id = auth.uid()`.
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
INTEGRATION_ENCRYPTION_KEY    (base64-encoded 32-byte AES-256 key)
```

**Current state:** `.env.local` already populated with live Supabase project credentials. Withings credentials are empty (integration UI will show disconnected).

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

See `TECH_DEBT.md` for the full register. Active items as of 2026-04-05:

1. **Hardcoded timezone** in profile-bootstrap (`"America/Chicago"`) — should be configurable at signup
2. **Unbounded list queries** — no LIMIT clause on `listByDateRange`; will grow with data
3. **No background job execution infrastructure** — `packages/jobs` is structured but has no cron/queue trigger

---

## What Still Needs Building

**Next sprint priorities:**
1. Configurable timezone at signup (TD-011)
2. Pagination / LIMIT on list queries for long-term data scaling
3. Background job execution infrastructure (cron/queue for Withings sync)

**Longer-horizon work:**
- Second provider adapter (Apple Health, Garmin, or Oura)
- AI-powered insights (model hookup, prompt templates)
- Mobile-responsive audit and polish pass
- Export/data-portability

---

## Testing Notes

- **Framework:** Vitest 2 (all packages), Playwright (E2E)
- **Current coverage:** 49 unit/integration tests across application, integrations, jobs, and web layers
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

| Date | Work Done |
|---|---|
| 2026-04-05 | Full check-in: survey, run, test, audit. Fixed lint error + README bug. Created FitnessAppContext.md, AGENTS.md, CURRENT_STATE.md, TECH_DEBT.md, TESTING.md |
| 2026-04-05 | Sprint: nutrition module (full stack), field-level form errors (body/recovery/cardio), React cache() on auth+profile+supabase client, shared createCoreServices() factory, shared form-utils, parseActionError utility, delete action error handling, Playwright E2E setup (4 spec files), security fix (RLS policies + userId filter on credential repo), 49 tests passing |
