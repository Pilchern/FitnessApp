import type { WeeklyWeightTrend } from "@fitness-app/application";
import type {
  MuscleGroupVolumeSummary,
  PersistedInsight,
  RecoveryCoachingSuggestion,
  SparseTrendPoint,
} from "@fitness-app/application";
import type {
  RecoveryCheckin,
  Supplement,
  WeeklyReview,
} from "@fitness-app/domain";
import type { WeekPlan } from "./helpers";

export type TrainingWeekData = {
  weekStart: string;
  weekEnd: string;
  liftsCompleted: number;
  ridesCompleted: number;
  zone2Minutes: number;
  totalMinutes: number;
};

export type HabitsToday = {
  items: Supplement[];
  takenTodayIds: string[];
  /** Days taken in the trailing 7 (including today), keyed by habit id. */
  weekCounts: Record<string, number>;
  logDate: string;
};

export type GoalProgress = {
  label: string;
  description: string;
  trend: "improving" | "maintaining" | "declining" | "insufficient_data";
  trendDetail: string;
};

export type TodayNutrition = {
  proteinHitDays: number;
  fiberTakenDays: number;
  totalDays: number;
};

export type NutritionTargetsSnapshot = {
  calories: number | null;
  proteinGrams: number | null;
  fiberGrams: number | null;
};

export type DashboardData = {
  trainingWeek: TrainingWeekData;
  latestRecovery: RecoveryCheckin | null;
  latestWeightLb: number | null;
  weightChangeLb: number | null;
  latestWaistIn: number | null;
  waistChangeIn: number | null;
  latestBodyFatPct: number | null;
  latestBodyDate: string | null;
  weightTrend: SparseTrendPoint[];
  recentReviews: WeeklyReview[];
  latestReview: WeeklyReview | null;
  topInsights: PersistedInsight[];
  coachingSuggestion: RecoveryCoachingSuggestion | null;
  journalStreak: number;
  goalProgress: GoalProgress[];
  todayNutrition: TodayNutrition | null;
  nutritionTargets: NutritionTargetsSnapshot;
  muscleGroupVolume: MuscleGroupVolumeSummary;
  weekPlan: WeekPlan;
  habits: HabitsToday;
  activity: ActivitySnapshot;
  weeklyWeight: WeeklyWeightTrend;
};

/** Apple Health daily metrics for the dashboard; nulls until the bridge syncs. */
export type ActivitySnapshot = {
  stepsToday: number | null;
  vo2Max: { value: number; date: string } | null;
};
