import type { TrainingPlan } from "@fitness-app/application";

/**
 * Nick's current plan (rehab phase after ACL reconstruction, surgeon visit
 * week of 2026-10-26). Update after PT confirms the bike ramp (10/14) and
 * again at surgical clearance.
 *
 * Zone 2 target: 30 + 30 + 45 = 105 min now; 140 after the 40/40/60 ramp,
 * 150 after 45/45/60. The dashboard Plan card, the weekly review and the
 * insight rules all read the target from the cardio templates (via the stored
 * weekly summary); this constant is only the fallback for a week with no
 * review yet. After a ramp change, edit the templates; keep this in step.
 */
export const NICK_TRAINING_PLAN: TrainingPlan = {
  weeklyZone2TargetMinutes: 105,
  longZone2Weekday: null,
  vo2Required: false,
  cardioDaysLabel: "Monday, Wednesday, and Friday",
  excludedMuscleGroups: ["quads", "hamstrings", "glutes", "calves"],
  // Plan doc section 7: same wake time daily, 6:30 AM give or take 30 min.
  wakeTimeTarget: "06:30",
};

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
    "Lifts are upper body only (Tue/Thu/Sat); cardio is Zone 2 bike (Mon/Wed/Fri). Scheduled counts and the Zone 2 target in the data come from the current plan; judge adherence against them.",
    "Goal is a small calorie surplus with protein around 180 g/day, not a cut. Knee rehab is tracked in a separate app.",
  ].join("\n");
