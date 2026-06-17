import type { PersistedInsight, RecoveryCoachingSuggestion, SparseTrendPoint } from "@fitness-app/application";
import type { RecoveryCheckin, WeeklyReview } from "@fitness-app/domain";

export type TrainingWeekData = {
  weekStart: string;
  weekEnd: string;
  liftsCompleted: number;
  ridesCompleted: number;
  zone2Minutes: number;
  totalMinutes: number;
};

export type DashboardData = {
  trainingWeek: TrainingWeekData;
  latestRecovery: RecoveryCheckin | null;
  latestWeightLb: number | null;
  weightChangeLb: number | null;
  latestWaistIn: number | null;
  waistChangeIn: number | null;
  latestBodyFatPct: number | null;
  weightTrend: SparseTrendPoint[];
  recentReviews: WeeklyReview[];
  latestReview: WeeklyReview | null;
  topInsights: PersistedInsight[];
  coachingSuggestion: RecoveryCoachingSuggestion | null;
};
