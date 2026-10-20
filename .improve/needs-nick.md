# Needs Nick

Answer inline under each item (e.g. "Nick: yes"). The PM reads this at the start of every run. Ranked by urgency.

## Open


### N-003 (2026-10-20) Surgeon visit date conflict
The plan doc says the surgeon visit is the week of 10/26. The program seed's week notes say "Kazaglis visit 11/10: review gates" (`program_v2.py:598, 666-667`). Is Kazaglis the surgeon, and which date is right? It decides when gates get reviewed. Can ride along with N-002's seed fix.
**Decision:** correct date and role.




### N-007 (2026-10-20) Production URL is public with no login
Anyone with the URL can see the app. RLS still protects the data from the anon key, but the server renders your data for any visitor. Options: (a) keep it as is, (b) Vercel deployment protection (Hobby: preview-only), (c) a single shared-password gate in middleware.
**Decision:** a / b / c.

### N-008 (2026-10-20) Program v2.3 safety fixes before 11/30
Review of v2.2 found week 14+ items that need a seed change (B-25): an ungated Suitcase Carry, a two-leg Broad Jump shown as a fallback for single-leg jumps, a Deceleration Drill unlocked by the walk-jog gate, and barbell fallbacks shown while the barbell gate is closed.
**Decision:** OK to build and apply v2.3 next run? (PM rec: yes)

### N-009 (2026-10-20) Supabase: leaked-password protection and leftover seed_staging schema
(a) Leaked-password protection: Auth → Sign In / Providers → Email → "Prevent use of leaked passwords" (Pro plan; no effect since there is no password sign-in). (b) `drop schema seed_staging cascade;` clears the last search_path warning (the connector won't run DROP). Both optional.
**Decision:** do either, or ignore.

## Answered

### N-001 (2026-10-20) The improvement-cycle prompt is truncated
The scheduled prompt stops at "Every agent's report to the PM uses this format:". The report format, value bar, hard limits, and every step after the team table are missing.
Run 1 used PM defaults (`decisions.md` > "Operating defaults") and built 2 small items under them.
**Decision:** paste the rest of the prompt into the scheduled task, or reply "defaults OK".
Nick (2026-10-20): defaults OK (inferred from "go ahead with all of that").

### N-006 (2026-10-20) Migration approvals, low urgency
Three migrations are ready to build once you approve. Each is applied to live before merge.
- B-10: link logged lifts to program sessions, so adherence history survives late logging.
- B-11: security advisor fixes. Revoke anon GraphQL select (it currently exposes table structure, not rows), pin function search_path, turn on leaked-password protection.
- B-12: archive about 20k junk Strava retry rows and mark the Strava connection disconnected.

Separately, the production URL is public with no login. Keep it that way?
**Decision:** approve any of B-10/B-11/B-12 by ID.
Nick (2026-10-20): B-10 and B-11 yes; B-12 no (PM rec). Public URL / no login: still unanswered, re-asked in N-007.

### N-005 (2026-10-20) Three weekly Zone 2 targets (TD-040)
The dashboard shows 150 this week and 105 from week 10 (it reads the program). The Monday review and insights use 95 (they read the templates). The test-day note says 150. `profiles.baseline_schedule` is written but never read.
**Decision:** (1) Make the program the single source, and drop `baseline_schedule` (column drop, needs your OK)? (2) Does the Thursday climb ride count toward the Z2 target? (3) Retire one of the two weekly reviews?
Nick (2026-10-20): program is the single source; drop baseline_schedule; retire the older weekly review. Building as W2; review retirement is scoped first.

### N-004 (2026-10-20) Fri 10/23 is a leg day, the day before the DEXA
The scan protocol (plan §17) allows only upper-body lifting the day before. No code needed.
**Decision:** skip the legs block on Fri 10/23? (y/n)
Nick (2026-10-20): yes, skip legs Fri 10/23. No code; tap Skip on the program card.

### N-002 (2026-10-20) Pogo hops start Fri 10/30 with no gate. Decide by Wed 10/28.
Block 1 "landing prep" (squat to calf raise, snap-down to stick, low double-leg pogo) is ungated from program week 10 (`supabase/generators/program_v2.py:181-186`). Every later pogo/jump is behind `plyo_double`, which can't clear before 11/09. Your 10/16 PT note says "still unable: jumping". Thursday climb intervals also start in week 10, ungated (`:536`); threshold 4x4 from week 14, VO2 from week 19.
**Decision:** (a) put landing prep behind `plyo_double` and add a `vo2` gate to the interval rides (v2.2 seed, applied to live with your OK), or (b) leave it and skip by hand unless the surgeon clears it. PM recommends (a).
Nick (2026-10-20): "go ahead with all of that" = gate both. Building as W1 (auto-improve/v2-2-gates).

### N-000 (2026-10-20) Merge PR #88 before Sat 10/24
The DEXA entry only helps if it's live before the scan. #87 (AI coaching text) has no deadline.
**Decision:** merge #88 (and #87) or say what to change.
Nick (2026-10-20): "go ahead and merge". Both #87 and #88 were squash-merged.
