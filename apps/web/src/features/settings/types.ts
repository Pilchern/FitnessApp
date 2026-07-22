import type { Supplement, UserProfile } from "@fitness-app/domain";

export type SettingsPageData = {
  profile: UserProfile;
  userEmail: string;
  supplements: Supplement[];
};

export type SettingsActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type SupplementActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type SettingsFormValues = {
  displayName: string;
  timezone: string;
  unitsSystem: string;
  weekStartsOn: string;
  goalFatLoss: boolean;
  goalPreserveMuscle: boolean;
  goalImproveVo2: boolean;
  dailyProteinGramsTarget: string;
  dailyCaloriesTarget: string;
  dailyFiberGramsTarget: string;
  targetWeightLb: string;
  targetDate: string;
};
