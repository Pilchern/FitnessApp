import type { TrainingPlan } from "@fitness-app/application";

/**
 * Nick's current plan (rehab phase after ACL reconstruction, surgeon visit
 * week of 2026-10-26). Update after PT confirms the bike ramp (10/14) and
 * again at surgical clearance.
 *
 * Zone 2 target: 30 + 30 + 45 = 105 min now; 140 after the 40/40/60 ramp,
 * 150 after 45/45/60. The dashboard Plan card and the weekly review read the
 * target from the cardio templates; this constant is the fallback and still
 * drives the insight rules, so change both.
 */
export const NICK_TRAINING_PLAN: TrainingPlan = {
  weeklyZone2TargetMinutes: 105,
  longZone2Weekday: null,
  vo2Required: false,
  cardioDaysLabel: "Monday, Wednesday, and Friday",
  excludedMuscleGroups: ["quads", "hamstrings", "glutes", "calves"],
};

export const NICK_AI_PLAN_CONTEXT = [
  "Recovering from ACL reconstruction (patellar tendon graft), about 8 weeks post-op; surgeon visit week of 2026-10-26.",
  "No running, jumping, plyometrics, or VO2 intervals until cleared. Do not suggest lower-body loading.",
  "Lifts are upper body only (Tue/Thu/Sat); cardio is Zone 2 bike (Mon/Wed/Fri). Scheduled counts and the Zone 2 target in the data come from the current plan; judge adherence against them.",
  "Goal is a small calorie surplus with protein around 180 g/day, not a cut. Knee rehab is tracked in a separate app.",
].join("\n");
