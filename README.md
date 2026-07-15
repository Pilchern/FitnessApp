# FitnessApp

Web-first health, fitness, recovery, body-composition, and journaling application scaffolded as a modular monorepo.

## Architecture at a glance

- `apps/web`: Next.js App Router delivery shell
- `packages/domain`: framework-free domain concepts and rules
- `packages/application`: use cases, ports, and boundary DTOs
- `packages/infrastructure`: database, storage, auth, and feature-flag adapters
- `packages/integrations`: provider adapters and canonical mappers
- `packages/jobs`: background job handlers and orchestration
- `supabase/`: migrations, policies, and seed assets
- `docs/`: architecture and schema notes
- `tests/`: end-to-end and shared fixtures

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the web environment template:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Fill in the required Supabase values in `apps/web/.env.local`.

4. For local database work, start and reset Supabase:

   ```bash
   supabase start
   supabase db reset
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed/001_local_dev_seed.sql
   ```

5. Start the development server:

   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Common commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm format
pnpm format:write
```

## Code placement

- Put route handlers, layouts, and server actions in `apps/web/src/app`.
- Put web-only shared UI in `apps/web/src/components/shared`.
- Put feature-specific web modules in `apps/web/src/features`.
- Put domain models, value objects, and rules in `packages/domain/src`.
- Put application use cases and ports in `packages/application/src`.
- Put Supabase repositories and adapters in `packages/infrastructure/src`.
- Put provider-specific import code in `packages/integrations/src/providers`.
- Put job handlers and scheduling code in `packages/jobs/src`.

## Current status

Implemented now:

- auth and protected app shell
- cardio, recovery, body, weekly review, journal, insights, strength, nutrition, and settings modules
- Supabase schema, seeds, and RLS
- Four provider integrations with sync observability: Strava (live), Withings (OAuth, needs credentials), Peloton (needs a connected account), Apple Health (HMAC webhook, sleep only today, needs a configured secret)
- Optional AI-generated insights via the Anthropic API (`AiInsightService`)
- 4 basic Playwright e2e specs (auth, body, cardio, weekly review)

Still intentionally incomplete:

- background job execution infrastructure (queue/retry/dead-letter — see TECH_DEBT.md TD-014)
- Apple Health fields beyond sleep (steps, VO2 max, resting HR, exercise minutes, active energy)
- AI-generated weekly review narrative (distinct from the existing AI insights)
- broader browser-level e2e coverage (integration flows, strength, recovery, nutrition, journal, insights, settings)
