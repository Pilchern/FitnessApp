# Backlog

Score = Value x Confidence x Taste / Effort. Value, Confidence, Taste 1-5; Effort S=1, M=2, L=4. "Nick" = needs his decision before build (see needs-nick.md).

| ID | Item | V | C | T | E | Score | Nick | Status |
|---|---|---|---|---|---|---|---|---|
| B-01 | Gate Block 1 landing prep (pogo, snap-down) behind `plyo_double`; decide on Thu climb/threshold/VO2 rides; fix "Kazaglis 11/10" note. v2.2 seed. | 5 | 5 | 5 | 2 | 62.5 | approved | shipped #96 |
| B-02 | Stale AI plan context and insight copy ("lifts upper body only", "no lower-body loading") | 4 | 5 | 5 | 1 | 100 | n | shipped #87 |
| B-03 | DEXA body fat % and lean mass on the manual body form, no migration | 4 | 4 | 5 | 1 | 80 | n | shipped #88 |
| B-04 | Dashboard stops generating/persisting insights on every load; timeout on the Claude call | 3 | 4 | 4 | 2 | 24 | n | shipped #92 |
| B-05 | Verify Monday Vercel crons (auto-finalize, insights) and add a heartbeat row | 3 | 3 | 4 | 1 | 36 | n | shipped #93 |
| B-06 | Program Today card and logger stepper buttons up to 44px | 2 | 5 | 5 | 1 | 50 | n | shipped #91 |
| B-07 | Rest timer: audible beep and wake lock (reuse routine-player code) | 2 | 3 | 4 | 1 | 24 | maybe (Watch may cover it) | shipped #91 |
| B-08 | One schedule and Z2 source (TD-040): adherence reads the program; drop baseline_schedule | 4 | 4 | 5 | 2 | 40 | y (N-005) | shipped #95 |
| B-09 | Two-sided weight pace band (flag losing or flat) | 3 | 3 | 4 | 2 | 18 | y (after DEXA path) | after 10/24 |
| B-10 | Link strength_sessions to program sessions (FK) | 3 | 4 | 4 | 2 | 24 | y (migration, N-006) | shipped #94 |
| B-11 | Security advisor fixes: revoke anon GraphQL select, function search_path, leaked-password protection | 2 | 4 | 3 | 1 | 24 | y (migration, N-006) | shipped #90 |
| B-12 | Sync history cleanup: ~20k Strava retry rows, stale April runs, Strava connection to disconnected | 1 | 5 | 3 | 1 | 15 | y (data migration, N-006) | blocked on Nick |
| B-13 | Tests for program `buildToday` and week view (extract pure helpers) | 3 | 4 | 3 | 2 | 18 | n | ready |
| B-14 | Docs (also: FitnessAppContext/CURRENT_STATE session rows for #87/#88, deferred to avoid conflicts): CURRENT_STATE stale Strava/Peloton issues and "no lower-body" owner context; known-issues severity note; plan doc §6/§9.1/§14/§15 stale lines | 2 | 5 | 4 | 1 | 40 | n (plan §5 VO2 day: y) | ready, ride with next code PR |
| B-15 | Delete dead journal code (TD-042) | 1 | 5 | 4 | 1 | 20 | n | shipped #89 |
| B-16 | Web app manifest and home-screen icon | 1 | 5 | 3 | 1 | 15 | n | shipped #91 |
| B-17 | Nutrition: one-tap fuel entry from Today, or cut it | ? | 2 | 4 | 2 | - | - | revisit 11/03; fuel entry is 1 day old, data immature |
| B-19 | Lift-day length text "55-60 min" vs v2.1 ~43-63 min (program_v2_engine.sql:65, program-settings.ts:95) | 1 | 5 | 4 | 1 | 20 | y (seed) | fold into B-01 seed |
| B-20 | Regional DEXA (per-leg) + thigh tape fields + scan-type marker | 2 | 3 | 4 | 2 | 12 | y (migration) | after 10/24 if Nick wants it |
| B-18 | TD-043 atomic set save (RPC) | 2 | 4 | 3 | 2 | 12 | y (migration) | parked |

## Evidence index
- B-01: supabase/generators/program_v2.py:181-186 (landing_prep has no gate; later pogo at :259 is gated), :536-545 Thu intervals, :598/:666-667 Kazaglis 11/10, :684 plyo_double earliest 11-09. Plan §1 PT note 10/16 "still unable: jumping"; §5 VO2 parked.
- B-02: apps/web/src/lib/training-plan.ts:48-50; packages/application/src/modules/insights/insight-rules.ts:548. PM verified.
- B-03: apps/web/src/features/body/form-schema.ts:4-12; body-metric.ts:30-36; dedup risk cross-provider-dedup.ts:398-418.
- B-04: features/dashboard/server.ts:103, features/insights/server.ts:61, ai-insight-service.ts:158 (no timeout), insight-orchestrator.ts:121.
- B-05: no insight rows in Monday 09:xx on 10-12 or 10-19; only weekly review is `completed` at 12:xx (cron writes `draft`). Vercel Hobby logs keep 1h.
- B-06: session-outcome-controls.tsx:49,65,154; knee-check-panel.tsx:107; program-today-card.tsx:134; strength-quick-form.tsx:136,149.
- B-07: strength-quick-form.tsx:347 uses navigator.vibrate only (iOS Safari no-op); routine-player.tsx:57-125 has WakeLock + AudioContext.
- B-08: dashboard/helpers.ts:195-221 (program) vs weekly-review-auto-finalize-service.ts:235-250 and features/weekly-review/server.ts:79 (templates); profile-bootstrap.ts:67 writes baseline_schedule, never read.
- B-10: 0 of 4 strength_sessions have training_template_id; no program session FK.

## New from run 2 reviews
| B-21 | Retire legacy /weekly-review (plan scoped in W2 report: cron writes completed, read-only week summary on /program/review, redirect) | 3 | 4 | 5 | 2 | 30 | n (approved) | after #93/#95 merge |
| B-22 | "Log Monday's session" entry point so late logs link to the program | 2 | 3 | 4 | 1 | 24 | n | ready |
| B-23 | Remaining TD-040 leftovers: hard-coded 140 Z2 fallback; /program/review targets from settings | 2 | 4 | 4 | 1 | 32 | n | ready |
| B-24 | Vercel builds auto-improve/state previews (orphan branch, fails). Ignore that branch in Vercel Git settings | 1 | 5 | 4 | 1 | 20 | owner setting | note to Nick |
| B-25 | Program v2.3 safety (from W1 review), all week 14+ (11/30+): gate Suitcase Carry (`carries`, sub Dead Bug); drop Broad Jump fallback on single-leg jumps + engine: never show a fallback that is itself a gated plyo; Deceleration Drill to `plyo_single`/`cutting` not `jog`; barbell fallbacks shown while `barbell` closed (Jump Squat sub to goblet box squat) | 5 | 5 | 5 | 2 | 62.5 | y (seed apply) | do before 11/30 |
| B-26 | Engine: narrow closed-gate ride→Zone 2 conversion to `intervals` gate explicitly | 1 | 4 | 4 | 1 | 16 | n | with B-25 |
