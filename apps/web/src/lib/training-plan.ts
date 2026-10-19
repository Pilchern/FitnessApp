import type { TrainingPlan } from "@fitness-app/application";

/**
 * Nick's current plan (rehab phase after ACL reconstruction, surgeon visit
 * week of 2026-10-26). Update again at surgical clearance.
 *
 * Zone 2 target: 40 + 40 + 60 = 140 min now (PT 10/16, "as tolerated");
 * 150 after 45/45/60. The dashboard Plan card, the weekly review and the
 * insight rules all read the target from the cardio templates (via the stored
 * weekly summary); this constant is only the fallback for a week with no
 * review yet. After a ramp change, edit the templates; keep this in step.
 */
export const NICK_TRAINING_PLAN: TrainingPlan = {
  weeklyZone2TargetMinutes: 140,
  longZone2Weekday: null,
  vo2Required: false,
  cardioDaysLabel: "Tuesday, Thursday, and Saturday",
  // Legs run in this app's program since 2026-10-19, so they count again.
  excludedMuscleGroups: [],
  // Plan doc section 7: same wake time daily, 6:00 AM give or take 30 min
  // (6:30 until 2026-10-18, 5:30 for a day, 6:00 from 2026-10-19).
  wakeTimeTarget: "06:00",
};

/**
 * Sleep target, hours asleep. In bed 9:30-10 PM to a 6:00 wake is 8-8.5 h
 * in bed (plan section 7: 8-9 h in bed), which is about 7.5 h asleep at the
 * Watch's usual efficiency. Readiness and the sleep plan score against this.
 */
export const SLEEP_TARGET_HOURS = 7.5;

/** Lights-out floor for the sleep plan: in bed from 9:30 PM (plan section 7). */
export const EARLIEST_BEDTIME = "21:30";

/** ACL reconstruction date (plan doc section 1: 2026-10-09 is post-op day 53). */
export const SURGERY_DATE = "2026-08-17";

export function weeksPostOp(now: Date = new Date()): number {
  const days = Math.floor(
    (now.getTime() - Date.parse(`${SURGERY_DATE}T00:00:00Z`)) / 86_400_000,
  );
  return Math.max(0, Math.floor(days / 7));
}

/** Built per request so the post-op week does not go stale. */
export const nickAiPlanContext = (now: Date = new Date()) =>
  [
    `Recovering from ACL reconstruction (patellar tendon graft), about ${weeksPostOp(now)} weeks post-op; surgeon visit week of 2026-10-26.`,
    "No running, jumping, plyometrics, or VO2 intervals until cleared. Do not suggest lower-body loading.",
    "Lifts are upper body only (Mon/Wed/Fri); cardio is Zone 2 bike (Tue/Thu/Sat). Scheduled counts and the Zone 2 target in the data come from the current plan; judge adherence against them.",
    "Goal is a small calorie surplus with protein around 180 g/day, not a cut. Knee rehab is tracked in a separate app.",
  ].join("\n");
