# Nick's fitness and health plan (as of Fri 2026-10-09)

Purpose: single source of truth for Claude Code working on this repo. Facts are tagged [stated] (Nick said it), [doc] (from his AI-Lab notes), [built] (exists in the app/database now), or [assumed] (a call made on 2026-10-09, change freely).

## 1. Situation

- ACL reconstruction (patellar tendon graft, BTB) with chondroplasty after a July 2026 injury. 2026-10-09 is post-op day 53 (about week 7.5). [doc]
- Knee: flexion past 110 degrees, about 10 degrees short of the good knee; full extension. Cleared for goblet squats and band work. PT limit: no squatting past 90 degrees. [stated]
- The graft is in its weakest biological window (ligamentization, roughly weeks 3-12). The plan loads progressively and early but avoids high-load terminal extension and anything impact until criteria are met. [doc]
- Next surgeon visit: week of 2026-10-26. PT visit Wed 2026-10-14 to confirm the bike ramp and a list of loading questions. [doc]
- Goals: preserve muscle, fat loss once cleared, improve VO2max, long-term longevity framework from Attia's Outlive. Soft recomp, not a cut, until full training returns. [stated]
- Work: Director of Marketplaces. Office Mon/Tue/Thu, WFH Wed/Fri. Leaves for the office by about 8:30 AM. PT is Wed and Fri 7:40 AM. [stated]
- Equipment (all he has): barbell, plates, adjustable dumbbells, bands, bench, squat/power rack, Peloton bike. No leg press, leg extension, hamstring curl, cable or pulldown machine, treadmill, elliptical. [stated]

## 2. Boundaries between systems

- FitnessApp (this repo, Supabase "Fitness App"): lifts, cardio, recovery, habits, nutrition checks, weekly review, body metrics. Upper-body training and cardio live here.
- PT Tracker (separate app, repo Pilchern/PT-Tracker, Vercel nick-pt-tracker): knee rehab home exercises, kneecap/swelling gating, loaded knee sessions. Do NOT merge it into FitnessApp and do not duplicate knee exercises here.
- AI-Lab (local files, ~/AI-Lab): life OS notes. Edits to its context/ files need Nick's approval. No JumpFly client data in personal repos.

## 3. Weekly schedule (current phase, through about 10/26)

Lifts Tue/Thu/Sat. Cardio Mon/Wed/Fri. [stated, 2026-10-09]

| Day | Work | Morning | Training | Notes |
|---|---|---|---|---|
| Mon | Office | Wake, light, Foundation Training, cold plunge, PT sheet round 1 | Bike Z2 30 min | Knee loaded block (PT Tracker) may still land here, see section 9 |
| Tue | Office | Same stack | Lift: Push (upper) | Knee block first, then upper |
| Wed | WFH | PT 7:40, cold plunge after | Bike Z2 30 min (evening) | 2 walks |
| Thu | Office | Same stack | Lift: Pull (upper) | Knee block first, then upper |
| Fri | WFH | PT 7:40 | Bike Z2 45 min (evening) | Mobility 15 min |
| Sat | Off | Same stack | Lift: Arms (upper) | Weekly review in the evening |
| Sun | Off | Walk 45-60 min outdoors | Rest | Meal prep, early bed |

Daily non-negotiables: PT home sheet AM and PM (PT Tracker), 7,000 steps, protein about 180 g, fixed wake time, bed about 10:00 PM, alcohol under 7 drinks per week.

## 4. Strength (FitnessApp templates, upper body only for now)

Rules: knee block (PT Tracker) first while fresh, then upper. Seated or supported DB work only; no standing heavy presses or unsupported bent-over rows yet. Pull-ups/chin-ups: reach the bar from the bench, step down onto the bench with the RIGHT leg, then the floor; no jumping or dropping. If that feels unsafe, use band pulldowns. Bench: feet flat, do not tuck the left foot under the bench. Get on/off benches and the floor leading with the right leg; do not kneel on the left. Load rule: last 2-3 reps hard, form clean, knee pain 3/10 or less; hit the top of the rep range on all sets, then add weight next session. Add load before reps, never both in one week.

Tue Push (sets x reps @ start weight lb):
1. Barbell Bench Press 3x8 @165, RIR 2
2. Dumbbell Shoulder Press (seated) 3x10 @15
3. Incline Dumbbell Press 3x10 @30
4. Lateral Raise 4x18 (18-20) @7.5
5. Cuban Press 2x10 @7.5
6. Tricep Extension (overhead, seated) 2x15 @15
7. Weighted Floor Crunch 3x15

Thu Pull:
1. Pull-Up 4x3 bodyweight (bench step-down rule)
2. Dumbbell Row (bench-supported, 1-arm) 4x12 @30
3. Face Pull (band) 3x20
4. Rear Delt Fly (chest-supported, incline bench) 3x15 @10
5. Dumbbell Curl 2x15 @20
6. DB Seated Side Bend 3x15 per side
7. Dead Hang 2 timed sets, build toward 2 minutes total across the week

Sat Arms:
1. Close-Grip Bench Press 3x10 @95
2. Chin-Up 4x3 bodyweight (bench step-down rule)
3. Lateral Raise 3x15 @10
4. Hammer Curl 2x15 @20
5. Band Anti-Rotation Press 3x10 per side (alternate with woodchop weekly; kneel on the right knee only, or stand)

Not yet allowed (ask PT 10/14): farmer carries (standing loaded), barbell back squat, loaded step-ups to higher boxes, heavy standing presses.

Short on time: cut upper accessories first. Never cut the knee block, never cut the daily ROM anchor.

Pre-injury baselines (resume targets after clearance, re-enter light over 2-3 weeks): bench 195x5-7, squat 195x4-5, OHP 110x8, RDL 155x6, pull-ups 8-10 strict. [doc]

## 5. Cardio

- Zone 2 on the Peloton, 97-130 W (56-75% of FTP 173 W, last tested 2026-05-21). Conversational pace, about 60-70% max HR. [doc]
- Full revolution, low resistance, seat high. Add resistance only if the next-morning swelling is unchanged. [doc]
- Ramp, pending PT confirmation on 10/14 [assumed]:
  - This week and next: Mon 30 + Wed 30 + Fri 45 = 105 min
  - Then 40 + 40 + 60 = 140 min
  - Then 45 + 45 + 60 = 150 min (Attia minimum is about 3 hr/wk; Huberman 150-200)
- VO2 work (4x4 at 184-208 W, recovery about 87 W) stays parked until the surgeon visit AND pain is 2/10 or less AND no swelling after Z2. Pre-injury this was a Saturday session.
- Post-clearance cardio target in Nick's notes is 2x/week, revised down from 3x [stated]. The current 3x bike is a rehab-phase choice (ROM, swelling control, graft-friendly loading). Decide at clearance whether to hold 3x or go to 2 longer sessions to keep weekly Z2 at 150-180 min. [open decision]
- No running, jumping or plyometrics. The patellar tendon is the weak link in a BTB graft; plyo needs a clinician sign-off.
- Return-to-run criteria (all required): full extension; flexion within 5% of the other knee; trace effusion at most; pain 2/10 or less; quad strength at least 80% LSI. Villena 2025 markers: single-leg press 1.25x bodyweight, 30 step-and-holds, Y-balance 90% or better. Ask PT to measure quad dynamometry on both legs.

## 6. Daily habits (FitnessApp, supplements.kind = habit)

1. Foundation Training 8-10 min (Eric Goodman: founder hold, decompression breathing). Evidence is promotional only; treated as a posture/warm-up habit, not part of the strength budget.
2. Morning sunlight 10-20 min after waking.
3. 7,000 steps (manual checkbox until Apple Health syncs).
4. Mobility 15 min (static stretching; no knee-loaded stretches while rehabbing).

Already tracked elsewhere in the app, do not duplicate: cold plunge (recovery check-in; M-F first thing in the morning, 55F, 5 min, then sunlight), wake and bed time (recovery check-in), protein hit, fiber and alcohol (nutrition log), supplements (kind = supplement).

## 7. Recovery and sleep

- Fixed wake time 6:30 AM, 7 days a week [assumed; Nick's stated 5:30 target is not being met, and consistency beats an aspirational time]. Bed about 10:00 PM, 9:30 PM ceiling for wind-down creep. 8-9 hours in bed (Attia).
- Cold plunge M-F AM is fine because lifts are in the evening. If lifts move to the morning, no plunge within about 2 hours after lifting (Huberman).
- Wearable: moving off Apple Watch to an Oura Ring 5 (Whoop and RingConn were the alternatives). iPhone user; steps and sleep also feed UHC Rewards. [stated]
- Recovery coaching in the app already warns on soreness 8+ and low readiness.

## 8. Nutrition

- Recovery mode, not a cut: small surplus above maintenance, protein holds at about 180 g/day, eat to satiety with protein priority. Actual TDEE is lower right now than pre-injury. Anchor-based meals, no calorie logging app. [stated/doc]
- Weekday anchors: morning shake (whey + collagen + milk), 10:30 AM Greek yogurt + berries + flax + granola, psyllium husk before lunch, 2 PM lean protein + controlled carbs, post-lift whey only if dinner is more than 30-45 min out, dinner protein-centered with 2 Brazil nuts. Total about 160-185 g protein. Protein powder: Huel Black vanilla. [doc/stated]
- Appetite note: not hungry until about noon during rehab; likely still short on protein and calories. Watch the weekly weigh-in trend (Withings) rather than logging.
- Fiber target about 50 g (Attia) [assumed, not set in the app]. Calorie target intentionally unset in the app.
- The post-clearance cut (day-specific calories, deficit math, stall diagnostic) is parked in AI-Lab fitness-resumption-reference.md. Do not reactivate before full training returns.
- Pace guard: losing over 1.5 lb/week means add calories; under 0.5 lb/week means audit weekends before cutting weekdays. [doc]

## 9. Open conflicts and decisions

1. PT Tracker still schedules loaded knee sessions Mon/Tue/Thu. Monday is now a bike day. Options: keep the Monday knee block and bike after it, or move it. Nick has not decided; PT Tracker was left unchanged.
2. The AI-Lab Phase III plan lists lifts Mon/Tue/Thu (Push/Pull/Arms with knee blocks). Nick's 2026-10-09 instruction overrides: lifts Tue/Thu/Sat. The AI-Lab docs have not been updated; edits need his approval.
3. Cardio 3x (now) vs 2x (stated post-clearance target).
4. Bike ramp and farmer carries wait on PT 10/14.
5. Foundation Training and dead hangs were additions; Nick can drop either.

## 10. PT visit ask list, Wed 2026-10-14

- Quad dynamometry both legs; contralateral knee ROM measured.
- Seated band knee extension 90-45 degrees: OK to load heavier?
- Loaded step-up height and barbell limits (pin box squat to about 60).
- Medicine ball weight for the chest squat.
- Does the 10/9 sheet replace the 9/1 home program?
- Single-leg press and Y-balance criteria; jog and plyo criteria.
- Confirm the bike ramp (40/40/60 then 45/45/60) and standing carries.
- Book the surgeon follow-up for the week of 10/26.

## 11. Health admin (time-sensitive)

- Call the PCP (McGowan) to unblock bloodwork: apoB and Lp(a) (Attia), plus the semen analysis for family planning (trying to conceive since Sept 2026). Do it before the out-of-pocket window resets on 12/31. [stated/doc]
- Workers' comp (Hanover) claim for the July knee injury is open.
- The surgeon visit week of 10/26 is the gate for everything marked "parked".

## 12. Post-clearance structure (conditional, after surgeon sign-off)

- Lifting 3x/week full body (Tue/Thu/Sat); the knee work folds into strength days instead of separate sessions. Re-enter light over 2-3 weeks; baselines in section 4. Missed lift: move to the next available day, do not double up.
- Cardio: weekly Z2 150-180 min; one VO2 4x4 session per week; retest FTP after returning to structured riding, then every 6-8 weeks.
- Run-walk only after the section 5 criteria. Golf only after ortho clearance.
- Nutrition: reactivate the cut from the parked reference.
- Long-term targets, not current: dead hang 2 min, farmer carry about half bodyweight per hand for 1 min, protein about 1 g/lb, heavy lifting about 4x/week per Attia, stability work.

## 13. Evidence notes (so you can push back)

- Attia/Outlive: Z2 about 3 hr/wk, VO2 4x4 once or twice a week, strength emphasis, protein about 1 g/lb. Critics note overstated VO2 causality and a vague "stability" pillar.
- Huberman: Z2 150-200 min/wk, one HIIT, resistance 2-4x/wk, morning light, no ice bath right after lifting.
- Foundation Training: no peer-reviewed trial found.
- BFR: weak evidence, high bias risk; not owned, not recommended unless PT sets dosing.
- Graft loading: early controlled loading likely helps (Forelli 2025); avoid high-load terminal extension and full-range high-force work for 6-9 months (Wilk 2021).

## 14. What exists in the app now [built]

- Dashboard: Plan card (templates laid over the week, Done/Missed/Planned, Z2 minutes vs a target summed from cardio templates' targetZone2Minutes), Today's habits checklist with 7-day counts.
- /strength: Today's plan callout; Load plan prefills sets; weight starts at the last logged working-set weight, with "Last (date): 165 x 8, 8, 7".
- Live database seeded by hand: 3 strength templates (Tue/Thu/Sat), 3 cardio templates (Mon 30, Wed 30, Fri 45), 4 habits, protein target 180.
- Schema: supplements.kind (supplement | habit), migration applied live.
- Live data counts at last check: 131 imported rides, 275 body metrics, 1 profile, 0 lifts logged, 1 recovery check-in, 0 nutrition logs.
- Docs: CLAUDE.md, CURRENT_STATE.md "Start Here", TECH_DEBT.md TD-039/TD-040, FitnessAppContext.md session log.

## 15. Suggested next work, ranked

1. Apple Health bridge (Health Auto Export) to the existing webhooks for steps, sleep and rides; then auto-check the 7,000 steps habit from daily_activity_metrics. Biggest tracking gain, no new schema.
2. After PT 10/14: edit the cardio templates' targetZone2Minutes and durations for the 40/40/60 ramp. No code change needed.
3. Weekly review: include plan adherence (sessions done of scheduled) and habit completion in the auto summary and the AI draft.
4. Dashboard: show the weigh-in trend next to protein-hit days, since the rehab goal is a small surplus.
5. Decide TD-040 (delete profiles.baseline_schedule or drive the plan card from it; do not keep three sources of truth).
6. At surgeon clearance: swap templates to full-body lifts, add the VO2 session template, add a run-walk cardio sessionKind only if the domain needs it.
7. Do not build: a calorie logger, a knee rehab module, or a generic habit engine. Split habits out of the supplements tables only if they need per-day schedules or targets (TD-039).

## 16. Working style Nick expects

Answer first, direct, short. Smallest clean change reusing existing patterns. Name tradeoffs and opportunity cost. Tag numbers as fact, inferred or hypothesis. Do the math in code. No new docs or files unless asked, other than keeping the repo docs current. Never touch credentials, .env files or GitHub keys. Ask before external sends, calendar items, purchases over $200, and edits to AI-Lab context files.
