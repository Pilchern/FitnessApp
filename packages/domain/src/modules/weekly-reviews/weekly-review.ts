import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";

export type WeeklyReviewStatus = "draft" | "completed";

export type WeeklyReviewSummary = {
  averageWeightLb?: number | null;
  waistIn?: number | null;
  liftsCompleted?: number | null;
  ridesCompleted?: number | null;
  zone2Minutes?: number | null;
  vo2Completed?: boolean | null;
  sleepAverageHours?: number | null;
  alcoholTotal?: number | null;
};

export type WeeklyReviewScoreComponent = {
  key: "lifts" | "rides" | "zone2" | "vo2" | "sleep" | "alcohol" | "confidence";
  label: string;
  score: number;
  maxScore: number;
  detail: string;
};

export type WeeklyReviewScoreBand = "strong" | "solid" | "fragile";

export type WeeklyReviewScoreDetails = {
  version: "v1";
  totalScore: number;
  band: WeeklyReviewScoreBand;
  components: WeeklyReviewScoreComponent[];
};

export type WeeklyReviewManualOverrides = Partial<
  Record<
    | "averageWeightLb"
    | "waistIn"
    | "liftsCompleted"
    | "ridesCompleted"
    | "zone2Minutes"
    | "vo2Completed"
    | "sleepAverageHours"
    | "alcoholTotal",
    boolean
  >
>;

export type WeeklyReview = {
  id: EntityId;
  userId: UserId;
  weekStart: IsoDate;
  weekEnd: IsoDate;
  status: WeeklyReviewStatus;
  summary: WeeklyReviewSummary;
  bestWin: string | null;
  biggestMiss: string | null;
  lesson: string | null;
  nextWeekPriority: string | null;
  confidence: number | null;
  scoreDetails: WeeklyReviewScoreDetails | null;
  strategicDecision: string | null;
  riskForecast: string | null;
  manualOverrides: WeeklyReviewManualOverrides;
  completedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
