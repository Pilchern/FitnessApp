/**
 * Weekly plan parameters that coaching rules and the weekly score measure
 * against. The default is the generic baseline; a deployment passes its own.
 */
export type TrainingPlan = {
  weeklyZone2TargetMinutes: number;
  /** Weekday (0 = Sunday) of the long Zone 2 anchor ride; null disables the missed-anchor rule. */
  longZone2Weekday: number | null;
  /** When false the VO2 session is excluded from the weekly score. */
  vo2Required: boolean;
  /** Human label for the planned cardio days, used in coaching copy. */
  cardioDaysLabel: string;
  /** Muscle groups not currently trained, so "neglected" rules skip them. */
  excludedMuscleGroups: readonly string[];
};

export const GENERIC_TRAINING_PLAN: TrainingPlan = {
  weeklyZone2TargetMinutes: 90,
  longZone2Weekday: 6,
  vo2Required: true,
  cardioDaysLabel: "Tuesday, Thursday, and Saturday",
  excludedMuscleGroups: [],
};
