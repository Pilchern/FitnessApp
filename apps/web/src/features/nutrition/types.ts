import type {
  MacroWeek,
  NutritionAdherenceSummary,
} from "@fitness-app/application";
import type { NutritionLog } from "@fitness-app/domain";

export type NutritionTargets = {
  dailyProteinGramsTarget: number | null;
  dailyCaloriesTarget: number | null;
  dailyFiberGramsTarget: number | null;
};

export type NutritionPageData = {
  logs: NutritionLog[];
  summary: NutritionAdherenceSummary;
  /** Last 7 days' macro averages vs the daily targets. */
  macroWeek: MacroWeek;
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
  proteinGrams: string;
  calories: string;
  netCarbsGrams: string;
  fatGrams: string;
  fiberGrams: string;
  creatineTaken: boolean;
  protein50By9am: boolean;
  notes: string;
};
