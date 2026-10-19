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

## Training program (post-op legs), Phase A

**What changed.** The program is data, not code: `training_programs` -> `program_blocks` (week range, default sets/reps/RIR) -> `program_sessions` (weekday, type lift/peloton/run/test/rest/walk_jog, ride prescription) -> `program_exercises` (sets, rep range, RIR, tempo, per-leg, measure reps/time/force, gate, readiness requirement, `block_part` legs/upper, `from_week`/`until_week`). `program_weeks` holds deload flags, `program_gates` the manual "cleared on" dates (with earliest dates), `program_session_outcomes` explicit skips (time/knee/sick/travel/other) and red-flag stops, `training_settings` every target and threshold. Week numbers count whole weeks from `training_programs.week_anchor_date` (2026-08-17), so 2026-10-19 is week 9. Seed: `supabase/migrations/20261019120100_seed_acl_lower_body_program.sql` (safe to rerun). Rules: `packages/application/src/modules/program/` (calendar, knee check, progression, plan, walk-jog, settings). Screens: dashboard Program card, `/program`, the `/strength` program callout and logger, Settings (gates and Program targets).

**Add a block** (e.g. Block 4 content), in SQL through the Supabase MCP or the dashboard:
1. Block 4 (weeks 23-38) and Return to Sport (39+) rows exist. For a new block, insert into `program_blocks` with `start_week`, `end_week`, default `sets_min/sets_max/reps_min/reps_max/rir_target`, and a display `rep_scheme`.
2. Insert its `program_sessions`: one row per weekday (`day_of_week` 0 = Sunday), `session_type`, ride fields for Peloton days. Walk-jog cannot go on Mon/Wed/Fri (table check).
3. Insert `program_exercises` per lift session, ordered by `exercise_order` (legs first, upper 30+). Leave sets/reps/RIR null to use the block's scheme. `block_part = 'upper'` for upper-body rows (loads prefill from history); `side_mode = 'per_leg'` for left/right work; `measure` = `time` or `force`; `gate_key` (and optional `substitute_name`) for gated work; `readiness_requirement = 'normal'` for work that only runs on a normal knee check; `from_week`/`until_week` for variations inside a block.
4. A deload or repeat block can skip steps 2-3 and set `sessions_from_block_id` to the block it repeats; mark its weeks `is_deload` in `program_weeks`.
5. A new gate is a row in `program_gates` (`gate_key`, `label`, optional `earliest_on`); it shows up in Settings.

**Change targets.** Settings -> Program targets edits `training_settings` rows: load steps (barbell 5, DB 2.5 to 25 lb then 5, cuff 2.5), min RIR to add load (2), the sleep cut-off for increases (6.5 h over 3 nights), hard-set RIR (4) and the weekly quad-set target (12-16), knee-check pain cut-offs (normal 2 or less, knee-off above 3), the knee-off streak (2 days), the knee-off ROM block (15 min), the red-flag contact and phone, and the walk-jog start, step and rest days. A blank value falls back to the built-in default. New keys go in as rows plus a field in `program-settings.ts`.

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
