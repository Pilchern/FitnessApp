import type {
  DailyReadiness,
  PeerFitness,
  DailyStrain,
  SleepPlan,
  PersistedInsight,
  TrendNote,
  WeeklyWeightTrend,
} from "@fitness-app/application";
import type { Supplement, WeeklyReview } from "@fitness-app/domain";
import type { WeekPlan, WeekPlanItem } from "./helpers";

export type HabitsToday = {
  items: Supplement[];
  takenTodayIds: string[];
  /** Days taken in the trailing 7 (including today), keyed by habit id. */
  weekCounts: Record<string, number>;
  logDate: string;
};

export type TodayNutrition = {
  proteinHitDays: number;
  fiberTakenDays: number;
  totalDays: number;
};

export type DashboardData = {
  today: string;
  readiness: DailyReadiness;
  peerFitness: PeerFitness;
  strainSleep: StrainSleep;
  readinessHistory: { date: string; score: number | null }[];
  readinessCall: string;
  todayItems: WeekPlanItem[];
  /** Today's logged how-you-feel rating, 1-10. */
  feelToday: number | null;
  zone2Minutes: number;
  weekPlan: WeekPlan;
  latestWeightLb: number | null;
  latestBodyFatPct: number | null;
  /** Withings 7-day avg + latest DEXA offset; an estimate, not a reading. */
  adjustedBodyFatPct: number | null;
  latestBodyDate: string | null;
  weeklyWeight: WeeklyWeightTrend;
  /** Protein-hit days over the last 7; null when nothing is logged. */
  proteinHit: { days: number; of: number } | null;
  latestReview: WeeklyReview | null;
  topInsights: PersistedInsight[];
  trendNotes: TrendNote[];
  habits: HabitsToday;
  activity: ActivitySnapshot;
};

/** Apple Health daily metrics for the dashboard; nulls until the bridge syncs. */
export type ActivitySnapshot = {
  stepsToday: number | null;
  vo2Max: { value: number; date: string } | null;
};

/** Last 7 days of strain (oldest first) and the sleep plan; strain is null until age and resting HR exist. */
export type StrainSleep = {
  strain: DailyStrain[] | null;
  missing: string | null;
  sleep: SleepPlan;
};
