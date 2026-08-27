import type { BiologicalSex } from "@fitness-app/domain";
import type { BodyMetricRepository } from "../body-metrics/body-metric";
import type { UserProfileRepository } from "./user-profile";

export type NutritionTargets = {
  dailyCaloriesTarget: number;
  dailyProteinGramsTarget: number;
  dailyFiberGramsTarget: number;
  /** True if the calculated deficit fell below MIN_SAFE_DAILY_CALORIES and was raised to that floor. */
  safetyFloorApplied: boolean;
  /**
   * Human-readable caveats about this estimate: which inputs were the user's
   * own and which fell back to a population average, plus whether the safety
   * floor was applied. Surface these in the UI rather than presenting the
   * numbers as precise — even fully populated, this is a formula estimate,
   * not a measurement or medical advice.
   */
  notes: string[];
};

const LB_TO_KG = 0.453592;
const DEFAULT_WEIGHT_KG = 75;
const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_AGE = 30;

/**
 * Sex-specific constants from Mifflin-St Jeor. When sex is unknown or the user
 * declined to state it, the midpoint is used rather than the male constant:
 * defaulting to +5 silently overestimates BMR for roughly half of users, and
 * the midpoint is wrong for everyone by a smaller and symmetric amount. The
 * estimate says so in its notes either way.
 */
const BMR_CONSTANT_MALE = 5;
const BMR_CONSTANT_FEMALE = -161;
const BMR_CONSTANT_UNKNOWN = (BMR_CONSTANT_MALE + BMR_CONSTANT_FEMALE) / 2;

/**
 * Age in whole years at `asOf`. Derived from a birth date rather than stored,
 * so it can't drift stale.
 */
export function computeAgeYears(birthDate: string, asOf: Date): number | null {
  const born = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(born.getTime())) {
    return null;
  }
  const reference = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  let age = reference.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = reference.getUTCMonth() - born.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && reference.getUTCDate() < born.getUTCDate())
  ) {
    age -= 1;
  }
  // A future or implausible birth date yields an unusable age; fall back to the
  // population default rather than feeding a negative number into the formula.
  if (age < 0 || age > 120) {
    return null;
  }
  return age;
}

function bmrConstantFor(sex: BiologicalSex | null | undefined): number {
  if (sex === "male") return BMR_CONSTANT_MALE;
  if (sex === "female") return BMR_CONSTANT_FEMALE;
  return BMR_CONSTANT_UNKNOWN;
}
/**
 * Conservative floor below which unsupervised calorie restriction is generally
 * discouraged without medical guidance. This is a guardrail against the fat-loss
 * deficit heuristic (tdee - 300) producing an unsafely low number for smaller or
 * older bodies once real body weight is factored in — not a personalized medical
 * minimum for any individual.
 */
const MIN_SAFE_DAILY_CALORIES = 1200;

function computeBmr(input: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: BiologicalSex | null;
}): number {
  return (
    10 * input.weightKg +
    6.25 * input.heightCm -
    5 * input.ageYears +
    bmrConstantFor(input.sex)
  );
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

/** "height", "height and age", "height, age, and biological sex" */
function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function roundToNearest50(value: number): number {
  return Math.round(value / 50) * 50;
}

function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5;
}

export class NutritionTargetService {
  /**
   * `now` is injectable purely so the age derivation is testable at a fixed
   * date; production callers use the default.
   */
  constructor(
    private readonly profileRepository: UserProfileRepository,
    private readonly bodyMetricRepository: BodyMetricRepository,
    private readonly now: () => Date = () => new Date(),
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

    const notes: string[] = [];
    const defaulted: string[] = [];

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

    let heightCm: number;
    if (profile.heightCm != null) {
      heightCm = profile.heightCm;
    } else {
      heightCm = DEFAULT_HEIGHT_CM;
      defaulted.push("height");
    }

    let ageYears: number;
    const derivedAge =
      profile.birthDate != null
        ? computeAgeYears(profile.birthDate, this.now())
        : null;
    if (derivedAge != null) {
      ageYears = derivedAge;
    } else {
      ageYears = DEFAULT_AGE;
      defaulted.push("age");
    }

    // "unspecified" is a deliberate choice, not a missing value — but the
    // formula still has no sex-specific constant to use, so it is disclosed
    // the same way as an absent one.
    const sex =
      profile.biologicalSex === "male" || profile.biologicalSex === "female"
        ? profile.biologicalSex
        : null;
    if (sex == null) {
      defaulted.push("biological sex");
    }

    if (defaulted.length > 0) {
      notes.push(
        `Estimated using a population average for ${formatList(defaulted)} — fill ${defaulted.length === 1 ? "it" : "those"} in under Settings for a closer estimate. This is a rough starting point, not a personalized or medical target.`,
      );
    } else {
      notes.push(
        "Calculated from your own height, age, biological sex, and latest logged weight. It is still a formula estimate, not a measurement or medical advice.",
      );
    }

    const bmr = computeBmr({ weightKg, heightCm, ageYears, sex });
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
