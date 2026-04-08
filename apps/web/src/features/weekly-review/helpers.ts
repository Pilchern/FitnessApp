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
    bestWin: review?.bestWin ?? "",
    biggestMiss: review?.biggestMiss ?? "",
    lesson: review?.lesson ?? "",
    nextWeekPriority: review?.nextWeekPriority ?? "",
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

export function formatMetricValue(value: number | null | undefined, suffix = "") {
  if (value == null) {
    return "--";
  }

  return `${value}${suffix}`;
}
