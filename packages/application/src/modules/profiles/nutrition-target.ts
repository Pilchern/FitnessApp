import type { BodyMetricRepository } from "../body-metrics/body-metric";
import type { UserProfileRepository } from "./user-profile";

export type NutritionTargets = {
  dailyCaloriesTarget: number;
  dailyProteinGramsTarget: number;
  dailyFiberGramsTarget: number;
  /** True if the calculated deficit fell below MIN_SAFE_DAILY_CALORIES and was raised to that floor. */
  safetyFloorApplied: boolean;
  /**
   * Human-readable caveats about this estimate (missing body weight, age/height/sex
   * defaults, safety floor). The profile does not collect age, height, or biological
   * sex, so this is always a rough population-average estimate, not a personalized
   * or medical figure — surface these notes in the UI rather than presenting the
   * numbers as precise.
   */
  notes: string[];
};

const LB_TO_KG = 0.453592;
const DEFAULT_WEIGHT_KG = 75;
const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_AGE = 30;
/**
 * Conservative floor below which unsupervised calorie restriction is generally
 * discouraged without medical guidance. This is a guardrail against the fat-loss
 * deficit heuristic (tdee - 300) producing an unsafely low number for smaller or
 * older bodies once real body weight is factored in — not a personalized medical
 * minimum for any individual.
 */
const MIN_SAFE_DAILY_CALORIES = 1200;

function computeBmr(weightKg: number): number {
  return 10 * weightKg + 6.25 * DEFAULT_HEIGHT_CM - 5 * DEFAULT_AGE + 5;
}

function activityMultiplier(profile: {
  goalFatLoss: boolean;
  goalPreserveMuscle: boolean;
  goalImproveVo2: boolean;
}): number {
  if (
    profile.goalFatLoss &&
    !profile.goalPreserveMuscle &&
    !profile.goalImproveVo2
  ) {
    return 1.375;
  }
  if (profile.goalPreserveMuscle || profile.goalImproveVo2) {
    return 1.725;
  }
  return 1.55;
}

function roundToNearest50(value: number): number {
  return Math.round(value / 50) * 50;
}

function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

export class NutritionTargetService {
  constructor(
    private readonly profileRepository: UserProfileRepository,
    private readonly bodyMetricRepository: BodyMetricRepository,
  ) {}

  async computeNutritionTargets(userId: string): Promise<NutritionTargets> {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    const recentMetrics = await this.bodyMetricRepository.listByDateRange({
      userId,
    });

    const latestWithWeight = recentMetrics.find(
      (m) => m.weightKg != null || m.weightLb != null,
    );

    const notes: string[] = [
      "Estimated using population averages for age and height (your profile doesn't collect those yet) — treat this as a rough starting point, not a personalized or medical target.",
    ];

    let weightKg: number;
    if (latestWithWeight?.weightKg != null) {
      weightKg = latestWithWeight.weightKg;
    } else if (latestWithWeight?.weightLb != null) {
      weightKg = latestWithWeight.weightLb * LB_TO_KG;
    } else {
      weightKg = DEFAULT_WEIGHT_KG;
      notes.push(
        "No logged body weight found — used a default estimate weight, so this number may be significantly off. Log a body weight entry for a more accurate target.",
      );
    }

    const bmr = computeBmr(weightKg);
    const multiplier = activityMultiplier(profile);
    const tdee = bmr * multiplier;

    let caloriesRaw: number;
    if (profile.goalFatLoss) {
      caloriesRaw = tdee - 300;
    } else if (profile.goalPreserveMuscle) {
      caloriesRaw = tdee + 200;
    } else {
      caloriesRaw = tdee;
    }

    let dailyCaloriesTarget = roundToNearest50(caloriesRaw);
    const safetyFloorApplied = dailyCaloriesTarget < MIN_SAFE_DAILY_CALORIES;
    if (safetyFloorApplied) {
      dailyCaloriesTarget = MIN_SAFE_DAILY_CALORIES;
      notes.push(
        `Your calculated target was below a safe minimum, so it was raised to ${MIN_SAFE_DAILY_CALORIES} kcal/day. Sustained intake below this level should only be done under medical supervision.`,
      );
    }

    const dailyProteinGramsTarget = roundToNearest5(1.8 * weightKg);
    const dailyFiberGramsTarget = 35;

    return {
      dailyCaloriesTarget,
      dailyProteinGramsTarget,
      dailyFiberGramsTarget,
      safetyFloorApplied,
      notes,
    };
  }
}
