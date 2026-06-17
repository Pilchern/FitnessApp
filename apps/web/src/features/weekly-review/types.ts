import type {
  WeeklyReviewScoringResult,
} from "@fitness-app/application";
import type { WeeklyReview, WeeklyReviewSummary } from "@fitness-app/domain";

export type WeeklyReviewAutoPopulated = {
  proteinHitDays: number | null;
  fiberTakenDays: number | null;
  nutritionAdherencePct: number | null;
  nutritionLogCount: number;
  averageReadiness: number | null;
};

export type WeeklyReviewPageData = {
  weekStart: string;
  weekEnd: string;
  weekStartsOn: 0 | 1;
  autoSummary: WeeklyReviewSummary;
  autoPopulated: WeeklyReviewAutoPopulated;
  review: WeeklyReview | null;
  latestReview: WeeklyReview | null;
  initialScoring: WeeklyReviewScoringResult;
  formError?: string;
};

export type WeeklyReviewActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type WeeklyReviewFormValues = {
  id?: string;
  weekStart: string;
  weekEnd: string;
  averageWeightLb: string;
  waistIn: string;
  liftsCompleted: string;
  ridesCompleted: string;
  zone2Minutes: string;
  vo2Completed: "true" | "false";
  sleepAverageHours: string;
  alcoholTotal: string;
  bestWin: string;
  biggestMiss: string;
  lesson: string;
  nextWeekPriority: string;
  confidence: string;
  manualOverrides: Partial<Record<keyof WeeklyReviewSummary, boolean>>;
};
