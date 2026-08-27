import { mapAiDraftToManualFields } from "@fitness-app/application";
import type { WeeklyReview, WeeklyReviewSummary } from "@fitness-app/domain";
import type { WeeklyReviewFormValues } from "./types";

function numberToInput(value: number | null | undefined) {
  return value == null ? "" : `${value}`;
}

export function toWeeklyReviewFormValues(
  review: WeeklyReview | null,
  autoSummary: WeeklyReviewSummary,
  weekStart: string,
  weekEnd: string,
): WeeklyReviewFormValues {
  const summary = review?.summary ?? autoSummary;

  // When the user has just accepted the AI draft (ai_draft_status ===
  // "accepted") and hasn't saved manual values yet, pre-fill the reflection
  // fields from the draft. This is a form-state-only pre-fill — nothing is
  // written to the database until the user submits the normal save action.
  const aiPrefill =
    review?.aiDraftStatus === "accepted" && review.aiDraft
      ? mapAiDraftToManualFields(review.aiDraft)
      : null;

  return {
    id: review?.id,
    weekStart,
    weekEnd,
    averageWeightLb: numberToInput(summary.averageWeightLb),
    waistIn: numberToInput(summary.waistIn),
    liftsCompleted: numberToInput(summary.liftsCompleted),
    ridesCompleted: numberToInput(summary.ridesCompleted),
    zone2Minutes: numberToInput(summary.zone2Minutes),
    vo2Completed: summary.vo2Completed ? "true" : "false",
    sleepAverageHours: numberToInput(summary.sleepAverageHours),
    alcoholTotal: numberToInput(summary.alcoholTotal),
    bestWin: review?.bestWin ?? aiPrefill?.bestWin ?? "",
    biggestMiss: review?.biggestMiss ?? aiPrefill?.biggestMiss ?? "",
    lesson: review?.lesson ?? "",
    nextWeekPriority: review?.nextWeekPriority ?? "",
    strategicDecision:
      review?.strategicDecision ?? aiPrefill?.strategicDecision ?? "",
    riskForecast: review?.riskForecast ?? aiPrefill?.riskForecast ?? "",
    confidence: numberToInput(review?.confidence),
    manualOverrides: review?.manualOverrides ?? {},
  };
}

export function formatWeeklyReviewDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatMetricValue(
  value: number | null | undefined,
  suffix = "",
) {
  if (value == null) {
    return "--";
  }

  return `${value}${suffix}`;
}
