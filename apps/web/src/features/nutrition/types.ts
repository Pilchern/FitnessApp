import type { NutritionAdherenceSummary } from "@fitness-app/application";
import type { NutritionLog } from "@fitness-app/domain";

export type NutritionTargets = {
  dailyProteinGramsTarget: number | null;
  dailyCaloriesTarget: number | null;
  dailyFiberGramsTarget: number | null;
};

export type NutritionPageData = {
  logs: NutritionLog[];
  summary: NutritionAdherenceSummary;
  editingLog: NutritionLog | null;
  targets: NutritionTargets;
  formError?: string;
};

export type NutritionActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type NutritionFormValues = {
  id?: string;
  logDate: string;
  proteinHit: boolean;
  mealsOnPlan: boolean;
  noPostDinnerSnacking: boolean;
  junkLeakage: boolean;
  fiberTaken: boolean;
  alcoholCount: string;
  notes: string;
};
