# Product

## Who it serves
Nick, one user. Director-level operator, phone-first, ~9 weeks post ACL reconstruction (surgery 2026-08-17). Running post-op program v2.1: lifts Mon/Wed/Fri (legs + upper), bike Tue/Thu/Sat, daily habits, readiness from Apple Health (hourly) and Withings (daily). Knee rehab gates live in a separate app (PT Tracker).

## Core job
1. Tell Nick what to do today (program Today card, readiness call).
2. Make logging it fast on his phone (lift logger, synced rides, habits, check-in).
3. Show whether the plan is working (adherence, Z2 minutes, body comp, readiness trend).

## What "better" means
- Nothing the app says contradicts the plan doc or loosens a medical restriction.
- Fewer taps and less to read in the daily loop. Removing clutter beats adding surface.
- Data he already syncs beats new manual entry.
- Numbers are honest: cited methods, estimates labelled, one source of truth per target.

## Success metrics and baselines (2026-10-20, run 1)
| Metric | Baseline | Tag |
|---|---|---|
| Lifts done vs scheduled since program start | 4/4 sessions (10-12 to 10-19) | fact |
| Rides on plan days (Tue/Thu/Sat), last 30d | 16 synced rides | fact |
| Daily recovery check-in | 11/11 days (10-10 to 10-20) | fact |
| Habit logging days missed, last 14d | 2 (10-14, 10-15) | fact |
| Unused features | nutrition 0 rows, journal 0, skip/red-flag 0, Sunday check-in 0 (shipped 10-19) | fact |
| Weekly Z2 target sources that disagree | 3 (95 / 105 / 150) | fact |
| Prescribed sessions conflicting with clearance status | 1 block (landing prep from 10-30); 1 open question (Thu interval rides) | fact |
| CI checks | format, typecheck, lint, test (818 pass, 0 fail), build all green | fact |
| First-load JS | /strength 143 kB, /dashboard 110 kB, shared 102 kB | fact |
| Prod runtime errors, 7d | 0 (Hobby log retention is 1h; low confidence) | fact |
| DB writes on every dashboard load | yes (insight generate + persist) | fact |
| Monday Vercel crons producing output | unverified; evidence suggests no | hypothesis |
