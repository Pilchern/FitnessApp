# Decisions

## Operating defaults (PM-set, run 1, because the cycle prompt is truncated; see N-001)
- **Report format for agents:** Conclusion (3 lines) / Baselines or Changes / Findings with file:line and fact|inferred|hypothesis tag / Candidates (value, evidence, files, size, risk) / Open questions.
- **Value bar:** a change must improve Nick's daily loop or plan fidelity in the next 2-4 weeks, fix wrong data or wrong guidance, or remove recurring friction. No cosmetic-only or speculative-infra work.
- **Hard limits:** discovery agents are read-only. Builders work in isolated worktrees on `auto-improve/<slug>`, run all five CI checks, never push, never migrate, never write to live Supabase or Vercel, never touch credentials or .env. The PM pushes kept branches and opens draft PRs. No migrations or seed applies without Nick's approval. No health data in commits, PRs or state files (aggregate counts only).
- **Keep rule:** a fresh Reviewer (never the Builder) must pass it on correctness, scope, plan fit and value. A failed review means the branch is dropped or sent back once.
- **Throughput:** at most 2 builds per run while the defaults are in force. WIP gate is 5 pending branches.

## Shipped
| Date | PR | Item | Notes |
|---|---|---|---|
| 2026-10-20 | #88 | B-03 DEXA entry on /body, scale trend Withings-only | Merged same day on Nick's go-ahead, ahead of the 10/24 scan. |
| 2026-10-20 | #87 | B-02 AI coaching context matches program v2 | Merged same day. The context now says no intervals until cleared, pending N-002. |

## Rejected / dropped
(none yet)

## Do not propose
- Calorie logger. (plan §15.7)
- Knee rehab module, or merging/duplicating PT Tracker (strength tests, gait, return-to-sport gates). (plan §2, CLAUDE.md)
- Generic habit engine; splitting habits out of supplements unless per-day schedules/targets are needed. (plan §15.7, TD-039)
- Multi-user / SaaS features: auth hardening, account deletion, rate limiting. (built in July, removed in #27)
- New paid integrations, or reviving Strava/Peloton. (#41 retired them)
- Anything that implies medical clearance Nick doesn't have: running, jumping, plyo, VO2 intervals, squat past 90, standing climbs, farmer carries.
- Calorie or fiber targets. (left unset on purpose)
- Unverifiable formulas, e.g. a non-exercise VO2 estimate. (#57)
- E2E or test-infrastructure investment for its own sake.

## Nick's taste (from run 1 history research; 85 of 86 PRs merged)
1. **The plan is the spec.** Work that implements plan doc §3-§12 or a PT note gets merged fast (#65, #66, #70).
2. **He prunes rather than rejects.** He merges, then trims in a later PR: readiness v3 cut 813 lines, v2 went to v2.1 the same day, #41/#46 removed about 3.4k lines. Expect a tuning follow-up after first contact with real data.
3. **Automatic data beats manual entry** (Health Auto Export is the backbone). Manual-entry features go unused: nutrition and journal have 0 rows.
4. **Phone-first, short pages, fewer inputs** (#29, #37, #72, #83, #86).
5. **Cheap to reverse.** Settings-driven thresholds over hard-coded ones; he flip-flops targets against real life (wake time changed 3 times in 12h).
6. **Small PRs** (median about 140 lines). Large PRs only when he commissioned them.
7. **Cited, honest numbers:** estimates labelled, methods checkable.
7b. **Accepted both run-1 PRs within the hour** (plan-fit copy fix, time-boxed feature for a dated event). Confirms: plan fit plus a deadline gets merged fast.
8. **Feedback comes in chat, not in PR comments.** No owner review comments exist. Read the session log and docs for his reactions.
9. **Migrations:** applied to live with his approval before merge. Proposals with no migration ship faster.
