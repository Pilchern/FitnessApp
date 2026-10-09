# FitnessApp: notes for Claude Code

Single-user fitness tracker. Next.js 15 App Router + Supabase, pnpm monorepo. Owner: Nick (one user, not multi-tenant).

## Read first, in this order
1. `CURRENT_STATE.md`, the "Start Here" section: what changed most recently, what is in the live database, open items.
2. `docs/fitness-health-plan.md`: the full training, rehab-gate, nutrition and health plan this app is built to support. Check it before changing templates, targets or schedules.
3. `AGENTS.md`: layer rules and per-role guardrails (domain/application/infrastructure/web boundaries, server action patterns, migration rules).
4. `TECH_DEBT.md` and `docs/known-issues.md` before proposing new work.
5. `FitnessAppContext.md` for module status and the dated session log. Add a row when you finish a session.

## Commands
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format`, `pnpm build`. CI runs all five on every PR; run them locally first.
- `pnpm format:write` fixes Prettier drift. Markdown is Prettier-ignored.

## Rules that bite
- Layering: no React/Next/Supabase imports in `packages/domain`, `packages/application`, `packages/integrations`. Route handlers and server actions live only in `apps/web`.
- Mutations go through server actions with `requireCurrentUser()` first, Zod validation, and `{ error }` return state. Re-throw redirect errors; never swallow `NEXT_REDIRECT`.
- Migrations: new file `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, never edit an existing one, idempotent, RLS on, `set_updated_at` trigger, soft delete via `deleted_at`.
- The live Supabase project is "Fitness App" (`gugylcxatznwuduvxdle`). Migrations are applied to it through the Supabase MCP connector, with the owner's approval. A merged migration that has not been applied to live breaks reads; apply first, then merge.
- Web tests import helpers by relative path, not via `@fitness-app/*` aliases (apps/web has no vitest alias config).
- Deploys: Vercel project `fitness-app-web` builds from this repo. Push to `main` deploys production. Branch pushes get preview builds against the same live database.
- Shallow clones: `git fetch --depth=1000 origin BRANCH` rather than `--unshallow`.

## Data and privacy
- This database holds real health data. Do not paste rows into issues, PRs, docs or commit messages.
- Credentials live in `apps/web/.env.local` and Vercel. Never print, commit or log them.
- The owner's ACL rehab tracking is a separate app (PT Tracker). Do not merge it into this one.

## Working style the owner expects
Answer first, short, direct. Smallest clean change that reuses existing patterns. Say what the tradeoff is. No new docs or files unless asked, other than keeping the docs above current.
