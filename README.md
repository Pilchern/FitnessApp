# FitnessApp

Web-first health, fitness, recovery, and body-composition application scaffolded as a modular monorepo.

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

## Training program v2, Phase A (supersets, time budget, progression)

**What changed.** Migration `20261020090000_program_v2_engine.sql`: `program_exercises.superset_group` (A, B, C...) and `superset_order` (1, 2); session type `accessory` (the Tue/Thu block before the ride); 11 new `training_settings` rows (session time budget, rest by category, the 60-min flag, the new-block load multiplier 1.1, shoulder emphasis); the lift calendar slot is 60 min and the walking-asymmetry target 8% (only where still at the v1 default). Engine (`packages/application/src/modules/program/`): `session-budget.ts` estimates each session as sets x (work + rest) + warm-up 5 + gait drill 3 + transitions 4 (work 40 s or the hold time; rest 150 s main, 90 s after a superset pair, 60 s accessories and plyos; per-leg work counts both legs and rests once) and flags lift sessions over 60 min; `restAfterSet`/`restForTick` drive the logger's rest timer (left leg goes straight to the right, A1 straight to A2, the pair rest after A2). Walk-jog moves one whole stage per session after a normal next morning (1:1 x6, 2:1 x6, 3:1 x5, 5:1 x4, 10, 15, 20, 30 min continuous). A new block's suggested start is last block's top working load x 1.1 per step down in reps (divided for a step up), rounded down. Upper-body lifts now run through the same double progression as leg work. Screens: home header shows "next block starts <date>"; session cards show "About N min" and the over-budget flag; exercises and logger cards show A1/A2.

**Edit a block or swap an exercise.** The program is generated by `supabase/generators/<version>.py` (one Python definition per program version). Change the exercise there (name, sets, reps, RIR, `superset_group`/`superset_order`, gate and fallback), regenerate, and ship it as a new migration; never edit a merged one. A one-off swap can also be a single `update public.program_exercises set exercise_name = ... where id = ...` through the Supabase MCP. Check the session card afterwards: an over-budget lift shows in orange.

**Change targets.** Settings -> Program targets -> Session time budget (warm-up, gait drill, transitions, work per set, rest per category, the lift flag) and Progression (new-block multiplier).

## Training program v2, Phase B (the program seed)

**What changed.** `supabase/generators/program_v2.py` defines the whole v2 program once and emits `supabase/migrations/20261020120000_seed_program_v2.sql` (version "program v2, 2026-10-19"). 14 blocks, weeks 9-38 plus Return to Sport (39+, behind the `rts` gate) and the Triathlon placeholder; 93 session slots; 340 exercise rows. Lift days are A1/A2 pairs (`superset_group`/`superset_order`), at most 4 upper-body movements; plyos and power come first and unpaired. Tue/Thu get an accessory circuit before the ride (session type `accessory`). The shoulder-emphasis setting (Settings -> Program, 1 = on) adds a lateral raise to Wednesday's A pair in every block; it is a hidden `shoulder_emphasis` gate driven by the setting. The gait drill text is a setting shown after the warm-up. Starting loads come from logged history by exercise name; anything unlogged says "Find load". The seed retires the program's rows and upserts v2 in place (keys: block name, weekday + slot, exercise slot), so rerunning it changes nothing and logged history is never touched.

**Edit a block or swap an exercise.** Edit `program_v2.py` (each block's Mon/Wed/Fri is a function; `ex(order, name, part, category, sets, reps, ss="A1", ...)`), run `python3 supabase/generators/program_v2.py supabase/migrations/<new timestamp>_seed_program_v2_1.sql /tmp/chunks /tmp/program.json`, check the printed counts and quad sets, and ship the new migration. The generator refuses a lift day with more than 4 upper movements or two rows in one superset slot in the same week.

**Activate the triathlon block.** Set `program_blocks.activated_on` on "Triathlon (placeholder)" to the start date, then add its sessions (a new generator block or rows by hand). A manual block wins over the week-based one from that date.

## Training program, Phase B (adherence, fuel, sleep, body, Sunday review)

**What changed.** Migration `20261019160000_phase_b_adherence_fuel_review.sql`: `nutrition_logs` gains `protein_grams`, `calories`, `creatine_taken`, `protein_50_by_9am` (the fast daily entry on /nutrition); new `program_weekly_checkins` (one row per week: PT visits scheduled/attended, quad LSI %, walking asymmetry %, notes); 23 more `training_settings` rows. Rules: `packages/application/src/modules/program/weekly-review.ts` (scorecard, streaks, execution banner, nutrition/sleep weeks, readiness counts, lift week-over-week, next week's focus, copyable summary) and `program-ics.ts` (calendar export). The weight surplus rule (`buildWeeklyWeightTrend`) now takes its rate and weeks from settings. Screens: the dashboard Program card shows the scorecard, streaks and the execution / surplus / waist prompts (and a Sunday review button on Sundays); `/program/review` is the Sunday review (`?week=N` for past weeks); `/api/program/calendar` downloads an .ics of planned sessions through the end of the current block (at most 16 weeks). Reused, not rebuilt: Withings weight and the 7-day average, the body form's waist at the navel, Apple Health sleep plus the recovery check-in's manual hours and quality, and the habits list for the daily ROM check.

**Add a block.** Unchanged from Phase A (see above); the review and calendar read the same rows.

**Change targets.** Settings -> Program targets now also has: Adherence (leg sessions, rides, ROM days, PT visits per week; weeks before the execution banner), Calendar (lift, Peloton and Sunday test start times as HH:MM and lengths), Nutrition (lift-day and rest-day calories, the 160 g protein flag; the 180 g protein target stays in Settings -> profile), Sleep and body (7 h sleep flag, surplus rate and weeks, waist interval), Review (LSI target lines 70/80/90, asymmetry target 5%).

## Current status

Implemented now:

- auth and protected app shell
- cardio, recovery, body, weekly review, insights, strength, nutrition, and settings modules
- Supabase schema, seeds, and RLS
- Four provider integrations with sync observability: Withings (OAuth, live), Apple Health (per-user webhook token; sleep, daily metrics, and workouts), Strava (code live but paywalled by Strava), Peloton (code live but blocked by Peloton's API)
- Cross-provider duplicate detection with an explicit source-priority order, so the same ride or weigh-in arriving from two providers isn't double-counted
- Optional AI-generated insights via the Anthropic API (`AiInsightService`)
- 6 Playwright e2e specs (auth, navigation, body, cardio, integrations, weekly review)
- GitHub Actions CI running format, typecheck, lint, unit tests, and the production build on every pull request

Still intentionally incomplete:

- nutrition targets personalized to age, height, and biological sex — `profiles` has no such columns, so the BMR formula substitutes population defaults behind a safety floor and an in-UI disclosure (see TECH_DEBT.md TD-030)
- browser-level e2e coverage for strength, recovery, nutrition, insights, and settings
- a UI for inspecting or replaying failed sync runs (the retry queue and dead-letter path themselves exist)
