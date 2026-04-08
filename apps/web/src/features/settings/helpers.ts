import type { UserProfile } from "@fitness-app/domain";
import type { SettingsFormValues } from "./types";

export function toSettingsFormValues(profile: UserProfile): SettingsFormValues {
  return {
    displayName: profile.displayName,
    timezone: profile.timezone,
    unitsSystem: profile.unitsSystem,
    weekStartsOn: String(profile.weekStartsOn),
    goalFatLoss: profile.goalFatLoss,
    goalPreserveMuscle: profile.goalPreserveMuscle,
    goalImproveVo2: profile.goalImproveVo2,
    dailyProteinGramsTarget: profile.dailyProteinGramsTarget != null ? String(profile.dailyProteinGramsTarget) : "",
    dailyCaloriesTarget: profile.dailyCaloriesTarget != null ? String(profile.dailyCaloriesTarget) : "",
    dailyFiberGramsTarget: profile.dailyFiberGramsTarget != null ? String(profile.dailyFiberGramsTarget) : "",
  };
}

export const COMMON_TIMEZONES: { label: string; value: string }[] = [
  { label: "Eastern Time (ET)", value: "America/New_York" },
  { label: "Central Time (CT)", value: "America/Chicago" },
  { label: "Mountain Time (MT)", value: "America/Denver" },
  { label: "Mountain Time — Arizona (no DST)", value: "America/Phoenix" },
  { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
  { label: "Alaska Time (AKT)", value: "America/Anchorage" },
  { label: "Hawaii Time (HST)", value: "Pacific/Honolulu" },
  { label: "UTC", value: "UTC" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Paris / Berlin (CET/CEST)", value: "Europe/Paris" },
  { label: "Moscow (MSK)", value: "Europe/Moscow" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "India (IST)", value: "Asia/Kolkata" },
  { label: "Bangkok (ICT)", value: "Asia/Bangkok" },
  { label: "Singapore / Shanghai (CST)", value: "Asia/Singapore" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST/AEDT)", value: "Australia/Sydney" },
  { label: "Auckland (NZST/NZDT)", value: "Pacific/Auckland" },
];
