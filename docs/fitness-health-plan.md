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

Lifts Mon/Wed/Fri. Cardio Tue/Thu/Sat. Sunday rest. [stated 2026-10-12, session 8; replaces Tue/Thu/Sat lifts and Mon/Wed/Fri cardio]

| Day | Work | Morning | Training | Notes |
|---|---|---|---|---|
| Mon | Office | Wake, light, Foundation Training, cold plunge, PT sheet round 1 | Lift: Push (upper) | Knee block (PT Tracker) first, then upper |
| Tue | Office | Same stack | Bike Z2 30 min | Knee block day in PT Tracker; bike after it |
| Wed | WFH | PT 7:40, cold plunge after | Lift: Pull (upper, evening) | 2 walks |
| Thu | Office | Same stack | Bike Z2 30 min | Knee block day in PT Tracker; bike after it |
| Fri | WFH | PT 7:40 | Lift: Arms (upper, evening) | Mobility 15 min |
| Sat | Off | Same stack | Bike Z2 45 min (long ride) | Weekly review in the evening |
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

- Zone 2 on the Peloton, 97-130 W (56-75% of FTP 173 W, last tested 2026-05-21). Conversational pace, about 65-75% max HR (Peloton's band; the app moved from 60-70% on 2026-10-13 after the first measured ride credited 16 of 30 min). Replace with a measured band after the PT bike test or an FTP retest. [doc]
- Full revolution, low resistance, seat high. Add resistance only if the next-morning swelling is unchanged. [doc]
- Ramp, pending PT confirmation on 10/14 [assumed]:
  - This week and next: Mon 30 + Wed 30 + Fri 45 = 105 min
  - Then 40 + 40 + 60 = 140 min
  - Then 45 + 45 + 60 = 150 min (Attia minimum is about 3 hr/wk; Huberman 150-200)
- VO2 work (4x4 at 184-208 W, recovery about 87 W) stays parked until the surgeon visit AND pain is 2/10 or less AND no swelling after Z2. Pre-injury this was a Saturday session.
- Target structure [stated 2026-10-12]: three rides Tue/Thu/Sat, two Zone 2 and one VO2 4x4. Until the VO2 gate above is met, all three stay Zone 2 (the current templates). At the switch the VO2 ride goes on Tuesday [assumed: first ride of the week, the 4x4 is the shortest session on an office day, and Saturday stays the long Zone 2]. Two Z2 rides carry the weekly Z2 total, so the 150 min target means about 60 + 90 min, or accept less Z2 for the VO2 work.
- No running, jumping or plyometrics. The patellar tendon is the weak link in a BTB graft; plyo needs a clinician sign-off.
- Return-to-run criteria (all required): full extension; flexion within 5% of the other knee; trace effusion at most; pain 2/10 or less; quad strength at least 80% LSI. Villena 2025 markers: single-leg press 1.25x bodyweight, 30 step-and-holds, Y-balance 90% or better. Ask PT to measure quad dynamometry on both legs.

## 6. Daily habits (FitnessApp, supplements.kind = habit)

1. Foundation Training 8-10 min (Eric Goodman: founder hold, decompression breathing). Evidence is promotional only; treated as a posture/warm-up habit, not part of the strength budget. Guided routine in the app (`/routines/foundation`, about 8 min, all standing: decompression breathing and two rounds of founder holds, arms back/forward/overhead).
2. Morning sunlight 10-20 min after waking.
3. 7,000 steps (auto-ticked from synced Apple Health steps; the bridge is live via Health Auto Export since 2026-10-12). Ladder to 8,000 by 10/26 [stated 2026-10-12]; edit the habit name to move the threshold.
4. Mobility 15 min (static stretching; no knee-loaded stretches while rehabbing). Guided routine in the app (`/routines/mobility`, about 14 min: neck, doorway chest, lat, cross-body shoulder, seated thoracic rotation and extension, wrists, strap hamstrings and wall calves both sides, then left-hip-flexor and right figure-4 only). Content lives in `apps/web/src/lib/routines.ts`; each habit's Guide link and the end-of-routine "Mark done" tick the habit.

Already tracked elsewhere in the app, do not duplicate: cold plunge (recovery check-in; M-F first thing in the morning, 55F, 5 min, then sunlight), wake and bed time (recovery check-in), protein hit, fiber and alcohol (nutrition log), supplements (kind = supplement).

## 7. Recovery and sleep

- Anchor the wake time, not the bedtime [stated 2026-10-12: bedtime and wake should not be set in stone; struggling to fall asleep and to get up before 6:30]. Ranked by value: (1) same wake time 7 days a week, 6:30 AM give or take 30 min, weekends included; (2) a fixed wind-down (phone-free from 8:30 PM, dim lights, caffeine cutoff 11 AM); (3) morning light right after waking; (4) a fixed bedtime, lowest, and counterproductive with trouble falling asleep. Basis: CBT-I (fixed rise time, sleepy-gated bedtime) and sleep-regularity research (Windred 2024, UK Biobank).
- Bedtime is flexible: in bed when sleepy, not before about 9:45 PM, aiming to be asleep by about 10:30. Awake more than about 20 min: get up, dim light, return when sleepy. This replaces the 9:15 to 9:30 lights-out target in the 2026-10-12 session prompt. 8-9 hours in bed (Attia).
- Watch data, 6 nights to 2026-10-12 [fact]: about 8.2 h asleep, 8.6 h in the sleep window, 6.9 to 9.25 h range. Duration is fine; the 2.3 h swing points to irregular timing [inferred]. Track wake-time variability (bedtime and wake now sync from Apple Health), not a bedtime hit rate. Night knee pain delaying sleep onset is a PT question, not something to coach here.
- Cold plunge M-F AM is fine because lifts are in the evening. If lifts move to the morning, no plunge within about 2 hours after lifting (Huberman).
- Wearable: keeping the Apple Watch, no ring [stated 2026-10-12; replaces the earlier Oura Ring 5 plan]. iPhone user; steps and sleep also feed UHC Rewards. Withings scale for weight. Health Auto Export relays Watch and Peloton data to the app hourly.
- Recovery coaching in the app already warns on soreness 8+ and low readiness.

## 8. Nutrition

- Recovery mode, not a cut: small surplus above maintenance, protein holds at about 180 g/day, eat to satiety with protein priority. Actual TDEE is lower right now than pre-injury. Anchor-based meals, no calorie logging app. [stated/doc]
- Weekday anchors: morning shake (whey + collagen + milk), 10:30 AM Greek yogurt + berries + flax + granola, psyllium husk before lunch, 2 PM lean protein + controlled carbs, post-lift whey only if dinner is more than 30-45 min out, dinner protein-centered with 2 Brazil nuts. Total about 160-185 g protein. Protein powder: Huel Black vanilla. [doc/stated]
- Appetite note: not hungry until about noon during rehab; likely still short on protein and calories. Watch the weekly weigh-in trend (Withings) rather than logging.
- Fiber target about 50 g (Attia) [assumed, not set in the app]. Calorie target intentionally unset in the app.
- The post-clearance cut (day-specific calories, deficit math, stall diagnostic) is parked in AI-Lab fitness-resumption-reference.md. Do not reactivate before full training returns.
- Pace guard: losing over 1.5 lb/week means add calories; under 0.5 lb/week means audit weekends before cutting weekdays. [doc]
- Winter-to-summer body composition plan (lean gain, then cut) is in section 17, pending the 2026-10-24 DEXA.

## 9. Open conflicts and decisions

1. PT Tracker schedules loaded knee sessions Mon/Tue/Thu. Since the 2026-10-12 switch, Monday pairs the knee block with the Push lift and Tue/Thu pair it with the bike. The strength template notes still say "knee block first", which only applies on Monday now. PT Tracker was left unchanged.
2. The AI-Lab Phase III plan lists lifts Mon/Tue/Thu (Push/Pull/Arms with knee blocks). Nick's instruction overrides: lifts Mon/Wed/Fri as of 2026-10-12 (was Tue/Thu/Sat from 2026-10-09). The AI-Lab docs have not been updated; edits need his approval.
3. Resolved 2026-10-12: three rides, two Zone 2 plus one VO2 once cleared (section 5).
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
- Routines: OK to add the left-leg-forward split-stance stretch (right hip flexor), seated figure-4 on the left, the woodpecker, and floor work (8-point plank, prone extension)? Until then they are left out of the mobility and Foundation routines.
- Book the surgeon follow-up for the week of 10/26.

## 11. Health admin (time-sensitive)

- Call the PCP (McGowan) to unblock bloodwork: apoB and Lp(a) (Attia), plus the semen analysis for family planning (trying to conceive since Sept 2026). Do it before the out-of-pocket window resets on 12/31. [stated/doc]
- Workers' comp (Hanover) claim for the July knee injury is open.
- The surgeon visit week of 10/26 is the gate for everything marked "parked".

## 12. Post-clearance structure (conditional, after surgeon sign-off)

- Lifting 3x/week full body (Mon/Wed/Fri); the knee work folds into strength days instead of separate sessions. Re-enter light over 2-3 weeks; baselines in section 4. Missed lift: move to the next available day, do not double up.
- Cardio: Tue/Thu/Sat, two Zone 2 rides plus one VO2 4x4 (Tuesday); weekly Z2 150-180 min; retest FTP after returning to structured riding, then every 6-8 weeks.
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

- Dashboard (rebuilt 2026-10-12): Today card with a daily readiness score (Apple Health HRV and resting HR against your 30-day baseline, plus sleep; an estimate, not a medical measure) and a one-line call for today's planned session; Plan card (templates over the week, Done/Missed/Planned, Z2 vs template target); habits (tap saves); "What changed" trend notes (wake time vs 6:30 target, cardio, resting HR, weight, lifts); Body.
- /strength: Today's plan callout; Load plan prefills sets; weight starts at the last logged working-set weight, with "Last (date): 165 x 8, 8, 7".
- Live database seeded by hand: 3 strength templates (Mon Push, Wed Pull, Fri Arms), 3 cardio templates (Tue 30, Thu 30, Sat 45), 4 habits, protein target 180.
- Schema: supplements.kind (supplement | habit), migration applied live.
- Live data counts at last check (2026-10-12): 144 rides (131 historical Strava, the rest from Apple Health), 294 body metrics, 0 lifts logged, recovery rows created nightly by the Apple Health sleep sync, 0 nutrition logs.
- Apple Health (Health Auto Export, hourly): steps (auto-ticks the steps habit), resting HR, HRV, VO2 max, sleep with bedtime and wake, Peloton rides. Withings syncs daily.
- Docs: CLAUDE.md, CURRENT_STATE.md "Start Here", TECH_DEBT.md TD-039/TD-040, FitnessAppContext.md session log.

## 15. Suggested next work, ranked

1. [done 2026-10-12] Apple Health bridge (Health Auto Export) to the existing webhooks for steps, sleep and rides; then auto-check the 7,000 steps habit from daily_activity_metrics. Biggest tracking gain, no new schema.
2. After PT 10/14: edit the cardio templates' targetZone2Minutes and durations for the 40/40/60 ramp. No code change needed.
3. [done 2026-10-09] Weekly review: include plan adherence (sessions done of scheduled) and habit completion in the auto summary and the AI draft.
4. [done 2026-10-09] Dashboard: show the weigh-in trend next to protein-hit days, since the rehab goal is a small surplus.
5. Decide TD-040 (delete profiles.baseline_schedule or drive the plan card from it; do not keep three sources of truth).
6. At surgeon clearance: swap templates to full-body lifts, add the VO2 session template, add a run-walk cardio sessionKind only if the domain needs it.
7. Do not build: a calorie logger, a knee rehab module, or a generic habit engine. Split habits out of the supplements tables only if they need per-day schedules or targets (TD-039).

## 16. Working style Nick expects

Answer first, direct, short. Smallest clean change reusing existing patterns. Name tradeoffs and opportunity cost. Tag numbers as fact, inferred or hypothesis. Do the math in code. No new docs or files unless asked, other than keeping the repo docs current. Never touch credentials, .env files or GitHub keys. Ask before external sends, calendar items, purchases over $200, and edits to AI-Lab context files.

## 17. Body composition plan, pending the 2026-10-24 DEXA [stated/assumed 2026-10-14]

Goal [stated]: visibly lean and muscular by late May/early June 2027, built for hiking, golf, sports and longevity, not maximum size. Lock the targets below once the DEXA is back; until then they are drafts.

Starting point (Withings BIA, mid-October; directional only, foot-to-foot BIA is skewed by the atrophied, swollen left leg) [fact]: about 177-178 lb, about 21% body fat, about 141 lb lean, FFMI about 19. Weight down about 14 lb from spring 2026; flat since mid-September. Roughly half the loss is inferred to be lower body (operated thigh and glute, 3-7 lb) plus water and glycogen (3-5 lb); fat about 5-7 lb. Drivers: post-op unloading, a no-appetite week, stopping cannabis (appetite drop is a known withdrawal effect). Nick is lower-body heavy, so leg loss is likely at the high end.

Decision rule after the DEXA:
- DEXA body fat 18% or less: a short lean bulk (+300-500 kcal) through January is viable.
- Above 18%: no bulk. Lean gain at +100-200 kcal (default, Path B below).

Draft plan (Path B):
- Phase 1, now to Jan 31 (rebuild): +100-200 kcal, protein 180 g, extra carbs around lifts. Weekly average weight +0.25-0.5 lb; faster with a growing waist means pull back. Upper-body hypertrophy Mon/Wed/Fri (8-12 reps, 1-2 in reserve); legs follow PT; ask PT about loaded hip thrusts/glute bridges. Z2 ramp to 150-180 min, VO2 4x4 once gated. Steps to 10,000 by January. FTP retest mid-January (aim 185 W or more). Expected peak about 185-187 lb.
- Phase 2, Feb 1 to May 31 (cut): -400-500 kcal, 0.75-1 lb/week, protein 180 g, reactivate the parked cut reference if full training is cleared. Full body 3-4x/week heavy (4-8 reps) plus carries, single-leg and rotational core. Two Z2 rides plus one VO2 4x4. If leg loading is still restricted at month 6, start the cut in March and accept about 15% in June.
- Phase 3, June to Sept: maintenance, golf, hiking, lift 3x/week. A real lean bulk next fall from about 14% if more size is wanted.
- Return to sport: golf in steps (chip/putt, half swing, full swing) on ortho clearance; ask about lead (left) knee rotation [assumed right-handed]. Cutting/pivoting sports not before month 9 (mid-May 2027) and passing return-to-sport tests (Grindem 2016: reinjury risk fell about 51% per month of delay up to 9 months). Hiking descents: step-down progression, poles at first.

Draft June 1, 2027 targets (reset in DEXA terms after the baseline):
| Area | Target |
|---|---|
| Weight | 168-174 lb (172-180 acceptable if lean mass lands higher) |
| Body fat (DEXA) | 13-15% |
| Lean mass | back to pre-injury about 148 lb or more |
| Leg symmetry | left leg lean within 5% of right; quad strength 90% or more of the other leg |
| Resting HR | under 60 |
| FTP | about 215 W (about 2.8 W/kg at 170 lb) |
| VO2max | lab baseline in Feb, +10% by June |
| Strength | bench 195x5, pull-ups 10+, dead hang 90 s, farmer carry 70 lb per hand for 1 min; squat/RDL back to pre-injury as PT allows |

Testing:
- DEXA at LiveLean, Saturday 9:40 AM, same machine every time: 2026-10-24 (baseline), about 2027-02-01 (end of Phase 1, add a cycle VO2max test once max efforts are cleared), about 2027-06-01. Confirm the repeat-scan price and the scanner model at the first visit. Lean changes under about 2 lb between scans are noise.
- Skipped: RMR (no calorie logging to plug it into; the weight trend answers it), DexaFit movement screen, sweat/sodium, nutrition consult.
- Bloodwork through the PCP before 12/31 (section 11): apoB, Lp(a), total and free testosterone, ferritin, fasting insulin, CMP, CBC. Fallback if the PCP stalls past about Dec 1: DexaFit wellness panel ($400; has apoB, Lp(a), hs-CRP, A1c, TSH, vitamin D; no testosterone).

Scan-day protocol (repeat exactly each time):
- Week before: normal eating and training. Do not start or stop creatine or change carbs or sodium on purpose.
- Day before: normal dinner by about 8 PM, no alcohol, no unusually salty or large meal. Upper-body lifting is fine; if PT that morning leaves the knee more swollen than usual on scan morning, reschedule.
- Scan morning: wake 6:30, water only (normal amount), no food, no coffee. Withings weigh-in at home right after the bathroom (gives a BIA-to-DEXA offset). Tape waist at the navel and both thighs 6 inches above the kneecap. Metal-free clothes, nothing in pockets. Empty the bladder right before the scan.
- After: eat, then the Saturday ride. Ask for the full PDF with regional (per-leg, per-arm, trunk) results.

