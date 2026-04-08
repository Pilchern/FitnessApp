import type { IsoDateTime, UserId } from "../../shared/ids";

export type UnitsSystem = "imperial" | "metric";
export type WeekStartsOn = 0 | 1;

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
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};
