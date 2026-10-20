# Backlog

Score = Value x Confidence x Taste / Effort. Value, Confidence, Taste 1-5; Effort S=1, M=2, L=4. "Nick" = needs his decision before build (see needs-nick.md).

| ID | Item | V | C | T | E | Score | Nick | Status |
|---|---|---|---|---|---|---|---|---|
| B-01 | Gate Block 1 landing prep (pogo, snap-down) behind `plyo_double`; decide on Thu climb/threshold/VO2 rides; fix "Kazaglis 11/10" note. v2.2 seed. | 5 | 5 | 5 | 2 | 62.5 | y (N-002, N-003) | blocked on Nick, deadline Fri 10/30 |
| B-02 | Stale AI plan context and insight copy ("lifts upper body only", "no lower-body loading") | 4 | 5 | 5 | 1 | 100 | n | kept, PR #87 |
| B-03 | DEXA body fat % and lean mass on the manual body form, no migration | 4 | 4 | 5 | 1 | 80 | n | kept, PR #88 (merge before Sat 10/24) |
| B-04 | Dashboard stops generating/persisting insights on every load; timeout on the Claude call | 3 | 4 | 4 | 2 | 24 | n | ready |
| B-05 | Verify Monday Vercel crons (auto-finalize, insights) and add a heartbeat row | 3 | 3 | 4 | 1 | 36 | n | ready (investigation first) |
| B-06 | Program Today card and logger stepper buttons up to 44px | 2 | 5 | 5 | 1 | 50 | n | ready |
| B-07 | Rest timer: audible beep and wake lock (reuse routine-player code) | 2 | 3 | 4 | 1 | 24 | maybe (Watch may cover it) | ready |
| B-08 | One schedule and Z2 source (TD-040): adherence reads the program; drop baseline_schedule | 4 | 4 | 5 | 2 | 40 | y (N-005) | blocked on Nick |
| B-09 | Two-sided weight pace band (flag losing or flat) | 3 | 3 | 4 | 2 | 18 | y (after DEXA path) | after 10/24 |
| B-10 | Link strength_sessions to program sessions (FK) | 3 | 4 | 4 | 2 | 24 | y (migration, N-006) | blocked on Nick |
| B-11 | Security advisor fixes: revoke anon GraphQL select, function search_path, leaked-password protection | 2 | 4 | 3 | 1 | 24 | y (migration, N-006) | blocked on Nick |
| B-12 | Sync history cleanup: ~20k Strava retry rows, stale April runs, Strava connection to disconnected | 1 | 5 | 3 | 1 | 15 | y (data migration, N-006) | blocked on Nick |
| B-13 | Tests for program `buildToday` and week view (extract pure helpers) | 3 | 4 | 3 | 2 | 18 | n | ready |
| B-14 | Docs: CURRENT_STATE stale Strava/Peloton issues and "no lower-body" owner context; known-issues severity note; plan doc §6/§9.1/§14/§15 stale lines | 2 | 5 | 4 | 1 | 40 | n (plan §5 VO2 day: y) | ready, ride with next code PR |
| B-15 | Delete dead journal code (TD-042) | 1 | 5 | 4 | 1 | 20 | n | ready |
| B-16 | Web app manifest and home-screen icon | 1 | 5 | 3 | 1 | 15 | n | ready |
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
