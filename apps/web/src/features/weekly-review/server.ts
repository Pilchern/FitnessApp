import "server-only";

import { NICK_TRAINING_PLAN } from "@/lib/training-plan";
import {
  buildNutritionAdherenceSummary,
  buildPlanAdherence,
  buildWeeklyReviewSummary,
  calculateWeeklyReviewScore,
  getLastCompletedWeekStart,
  getWeekRangeFromStart,
  loadWeekSchedule,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import type { WeeklyReviewAutoPopulated, WeeklyReviewPageData } from "./types";

export async function getWeeklyReviewPageData(
  weekStartParam?: string,
): Promise<WeeklyReviewPageData> {
  const user = await requireCurrentUser();
  const {
    profileService,
    bodyMetricService,
    cardioService,
    recoveryService,
    strengthSummaryService,
    weeklyReviewService,
    nutritionService,
    trainingTemplateService,
    programService,
    supplementService,
    supplementLogService,
  } = await createCoreServices();

  const profile = await profileService.getByUserId(user.id);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const weekStart =
    weekStartParam || getLastCompletedWeekStart(new Date(), weekStartsOn);
  const { weekEnd } = getWeekRangeFromStart(weekStart);

  const dateRangeQuery = {
    userId: user.id,
    startDate: weekStart,
    endDate: weekEnd,
  };

  const [
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    liftsCompleted,
    nutritionLogs,
    review,
    latestReview,
    schedule,
    supplements,
    habitLogs,
  ] = await Promise.all([
    bodyMetricService.listByDateRange(dateRangeQuery),
    cardioService.listByDateRange(dateRangeQuery),
    recoveryService.listByDateRange(dateRangeQuery),
    strengthSummaryService.countCompletedByDateRange(dateRangeQuery),
    nutritionService.listByDateRange(dateRangeQuery),
    weeklyReviewService.getByWeekStart({
      userId: user.id,
      weekStart,
    }),
    weeklyReviewService.getLatest(user.id),
    // Same week schedule as the Monday auto-finalize and the dashboard: the
    // program, with the templates only for a week no program covers.
    loadWeekSchedule(
      { programService, trainingTemplateService },
      dateRangeQuery,
    ),
    supplementService.listActive({ userId: user.id }),
    supplementLogService.listByDateRange(dateRangeQuery),
  ]);

  const autoSummary = buildWeeklyReviewSummary({
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    liftsCompleted,
    adherence: buildPlanAdherence({
      schedule,
      habitIds: supplements.filter((s) => s.kind === "habit").map((s) => s.id),
      habitLogs,
    }),
  });

  const nutritionSummary =
    nutritionLogs.length > 0
      ? buildNutritionAdherenceSummary(nutritionLogs)
      : null;

  const readinessValues = recoveryCheckins
    .map((checkin) => checkin.readinessLevel)
    .filter((value): value is number => value != null);
  const averageReadiness =
    readinessValues.length > 0
      ? Math.round(
          (readinessValues.reduce((sum, value) => sum + value, 0) /
            readinessValues.length) *
            10,
        ) / 10
      : null;

  const autoPopulated: WeeklyReviewAutoPopulated = {
    proteinHitDays: nutritionSummary ? nutritionSummary.proteinHitDays : null,
    fiberTakenDays: nutritionSummary ? nutritionSummary.fiberTakenDays : null,
    nutritionAdherencePct: nutritionSummary
      ? nutritionSummary.adherencePct
      : null,
    nutritionLogCount: nutritionLogs.length,
    averageReadiness,
  };

  const scoring = calculateWeeklyReviewScore({
    summary: review?.summary ?? autoSummary,
    confidence: review?.confidence ?? null,
    plan: NICK_TRAINING_PLAN,
  });

  return {
    weekStart,
    weekEnd,
    weekStartsOn,
    autoSummary,
    autoPopulated,
    review,
    latestReview,
    initialScoring: scoring,
  };
}

export async function getLatestWeeklyReview() {
  const user = await requireCurrentUser();
  const { weeklyReviewService } = await createCoreServices();
  return weeklyReviewService.getLatest(user.id);
}
