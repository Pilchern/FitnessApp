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

## Training program (post-op legs)

The program is data, not code: `training_programs` -> `program_blocks` (week range, default sets/reps/RIR) -> `program_sessions` (weekday, type, linked upper template, ride prescription) -> `program_exercises` (sets, rep range, RIR, tempo, per-leg, measure, gate). `program_weeks` holds deload flags; `program_gates` holds the manual "cleared on" dates set in Settings. Week numbers count whole weeks from `training_programs.week_anchor_date` (the surgery date). Seed: `supabase/migrations/20261019120100_seed_acl_lower_body_program.sql` (idempotent). Rules live in `packages/application/src/modules/program/`.

Add a block (e.g. Block 4 content), in SQL through the Supabase MCP or the dashboard:
1. The block row already exists for Block 4 (weeks 23-38). For a new one, insert into `program_blocks` with `start_week`, `end_week`, and the default `sets_min/sets_max/reps_min/reps_max/rir_target` and a display `rep_scheme`.
2. Insert its `program_sessions`: one row per weekday (`day_of_week` 0 = Sunday), `session_type` lift/peloton/test/walk_jog, and for lift days `upper_template_id` (the Mon/Wed/Fri strength template). Walk-jog cannot go on Mon/Wed/Fri (table check).
3. Insert `program_exercises` per lift session, ordered by `exercise_order`. Leave sets/reps/RIR null to use the block's scheme. Set `side_mode = 'per_leg'` for left/right work, `measure` = `time` or `force` for holds and isometrics, `gate_key` (and optionally `substitute_name`) for gated work, `readiness_requirement = 'normal'` for work that only runs on a normal knee check.
4. A deload or repeat block can skip steps 2-3 and set `sessions_from_block_id` to the block it repeats; mark its weeks `is_deload` in `program_weeks`.
5. Add a gate by inserting into `program_gates` (`gate_key`, `label`); it shows up in Settings.

Nothing else changes: the dashboard card, `/program`, `/strength` and the progression engine read these rows.

## Current status

Implemented now:

- auth and protected app shell
- cardio, recovery, body, weekly review, journal, insights, strength, nutrition, and settings modules
- Supabase schema, seeds, and RLS
- Four provider integrations with sync observability: Withings (OAuth, live), Apple Health (per-user webhook token; sleep, daily metrics, and workouts), Strava (code live but paywalled by Strava), Peloton (code live but blocked by Peloton's API)
- Cross-provider duplicate detection with an explicit source-priority order, so the same ride or weigh-in arriving from two providers isn't double-counted
- Optional AI-generated insights via the Anthropic API (`AiInsightService`)
- 6 Playwright e2e specs (auth, navigation, body, cardio, integrations, weekly review)
- GitHub Actions CI running format, typecheck, lint, unit tests, and the production build on every pull request

Still intentionally incomplete:

- nutrition targets personalized to age, height, and biological sex — `profiles` has no such columns, so the BMR formula substitutes population defaults behind a safety floor and an in-UI disclosure (see TECH_DEBT.md TD-030)
- browser-level e2e coverage for strength, recovery, nutrition, journal, insights, and settings
- a UI for inspecting or replaying failed sync runs (the retry queue and dead-letter path themselves exist)
