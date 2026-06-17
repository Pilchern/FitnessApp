import type { UserProfile } from "@fitness-app/domain";

export type SettingsPageData = {
  profile: UserProfile;
  userEmail: string;
};

export type SettingsActionState = {
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
};
