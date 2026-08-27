import type { IsoDateTime, UserId } from "../../shared/ids";

export type UnitsSystem = "imperial" | "metric";
export type WeekStartsOn = 0 | 1;

/**
 * Biological sex, used only for the sex-specific constant in the Mifflin-St
 * Jeor BMR formula. "unspecified" is a real, storable choice rather than an
 * absent value: it lets someone decline to answer without the calculation
 * quietly falling back to a male constant on their behalf. Both `null` and
 * "unspecified" make the estimate disclose that it used a population average.
 */
export type BiologicalSex = "male" | "female" | "unspecified";

export type UserProfile = {
  id: string;
  userId: UserId;
  displayName: string;
  timezone: string;
  unitsSystem: UnitsSystem;
  weekStartsOn: WeekStartsOn;
  goalFatLoss: boolean;
  goalPreserveMuscle: boolean;
  goalImproveVo2: boolean;
  dailyProteinGramsTarget: number | null;
  dailyCaloriesTarget: number | null;
  dailyFiberGramsTarget: number | null;
  targetWeightLb: number | null;
  targetDate: string | null;
  heightCm: number | null;
  /**
   * Stored as a birth date rather than an age, so the age used in the BMR
   * formula stays correct as time passes instead of drifting a year stale.
   */
  birthDate: string | null;
  biologicalSex: BiologicalSex | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};
