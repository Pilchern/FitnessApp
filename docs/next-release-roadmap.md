# Recommended Next Release

**Last verified against code:** 2026-08-26.

Since the 2026-07-21 version of this file, everything in its top-5 has shipped except the provider-configuration items, which are blocked on things outside this codebase. Cross-provider duplicate detection (TD-019) shipped 2026-08-26; timed/distance strength sets (TD-020), login rate limiting (TD-018), account deletion + export (TD-022), user-editable exercise overrides (TD-021), and numeric goal targets + training-plan scheduling (TD-027) all shipped earlier.

## Highest-value next steps

1. **TD-030 — personalize nutrition targets.** `NutritionTargetService` still substitutes a 30-year-old, 170cm, implicitly-male body for the user's real one, because `profiles` has no `heightCm`/`ageYears`/`biologicalSex` columns. This is the last Priority 1 item in `TECH_DEBT.md`. It needs an additive migration (nullable columns), so it also needs someone present to verify the change against the live Supabase project.
2. **Browser e2e for the uncovered modules** — strength, recovery, nutrition, journal, insights, settings. Six specs exist; these six modules have none. Strength is the highest-value of them: it has the most complex form logic in the app and the most stateful flows (templates, scheduling, set logging).
3. **Decide whether to retire the Strava and Peloton code paths.** Neither is realistically usable — Strava's API now requires a paid subscription the user has declined and its app registration is deactivated; Peloton's unofficial auth endpoint has been returning `403` for any credentials since 2026-07-16. The adapters, connect routes, weekly crons, and UI cards for both are still carried. Keeping them costs maintenance on every integration change; removing them is easy to reverse from git. This is a judgment call for the user, not something to decide unilaterally.
4. **AI-generated weekly review narrative in the weekly-review format.** `AiWeeklyReviewService` produces a draft (score/why/what-worked/what-needs-attention/strategic-decision/risk-forecast/next-action) that the user must accept; the rule-based numeric summary auto-fills separately. These two are not yet one coherent surface.
5. **Import-center retry tooling and richer sync diagnostics.** The retry queue and dead-letter path exist (TD-014); there is no UI for inspecting or replaying a failed run. The new cross-provider skip/supersede counters give this a second thing worth surfacing.

## User-side actions (not code)

These are blocked on the user, not on implementation:

1. Set a target weight/date under Settings → Training Goals and create the M/W/F strength templates with scheduled days under `/strength`. The capability shipped with TD-027; the numbers are personal data.
2. Once riding resumes, point a bridge app (e.g. Health Auto Export) at `POST /api/integrations/apple-health/workouts` — see `docs/integrations/apple-health-bridge-setup.md` for the payload shape. This is the recommended free cardio-sync path now that Strava is paywalled.

## Hardening follow-ups

1. Normalize server-action error mapping across all modules.
2. Add small shared composition helpers in `apps/web/src/lib/server` to reduce repeated repository wiring.
3. Consider batching the cross-provider duplicate lookup. It currently costs one same-day query per imported item, which is fine at a weekly cron over one user's rides but would not be at a bulk historical import.
