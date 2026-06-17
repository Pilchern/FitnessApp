import type { BodyMetricRepository } from "../body-metrics/body-metric";
import type { UserProfileRepository } from "./user-profile";

export type NutritionTargets = {
  dailyCaloriesTarget: number;
  dailyProteinGramsTarget: number;
  dailyFiberGramsTarget: number;
};

const LB_TO_KG = 0.453592;
const DEFAULT_WEIGHT_KG = 75;
const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_AGE = 30;

function computeBmr(weightKg: number): number {
  return 10 * weightKg + 6.25 * DEFAULT_HEIGHT_CM - 5 * DEFAULT_AGE + 5;
}

function activityMultiplier(profile: {
  goalFatLoss: boolean;
  goalPreserveMuscle: boolean;
  goalImproveVo2: boolean;
}): number {
  if (profile.goalFatLoss && !profile.goalPreserveMuscle && !profile.goalImproveVo2) {
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

    let weightKg: number;
    if (latestWithWeight?.weightKg != null) {
      weightKg = latestWithWeight.weightKg;
    } else if (latestWithWeight?.weightLb != null) {
      weightKg = latestWithWeight.weightLb * LB_TO_KG;
    } else {
      weightKg = DEFAULT_WEIGHT_KG;
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

    const dailyCaloriesTarget = roundToNearest50(caloriesRaw);
    const dailyProteinGramsTarget = roundToNearest5(1.8 * weightKg);
    const dailyFiberGramsTarget = 35;

    return {
      dailyCaloriesTarget,
      dailyProteinGramsTarget,
      dailyFiberGramsTarget,
    };
  }
}
