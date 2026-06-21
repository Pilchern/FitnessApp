import "server-only";

import {
  buildNutritionAdherenceSummary,
  buildWeeklyReviewSummary,
  calculateWeeklyReviewScore,
  getLastCompletedWeekStart,
  getWeekRangeFromStart,
  WeeklyReviewService,
} from "@fitness-app/application";
import { SupabaseWeeklyReviewRepository } from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
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
  } = await createCoreServices();

  const profile = await profileService.getByUserId(user.id);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const weekStart = weekStartParam || getLastCompletedWeekStart(new Date(), weekStartsOn);
  const { weekEnd } = getWeekRangeFromStart(weekStart);

  const dateRangeQuery = { userId: user.id, startDate: weekStart, endDate: weekEnd };

  const [
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    liftsCompleted,
    nutritionLogs,
    review,
    latestReview,
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
  ]);

  const autoSummary = buildWeeklyReviewSummary({
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    liftsCompleted,
  });

  const nutritionSummary =
    nutritionLogs.length > 0
      ? buildNutritionAdherenceSummary(nutritionLogs)
      : null;

  const averageReadiness = autoSummary.averageReadiness ?? null;

  const autoPopulated: WeeklyReviewAutoPopulated = {
    proteinHitDays: nutritionSummary ? nutritionSummary.proteinHitDays : null,
    fiberTakenDays: nutritionSummary ? nutritionSummary.fiberTakenDays : null,
    nutritionAdherencePct: nutritionSummary ? nutritionSummary.adherencePct : null,
    nutritionLogCount: nutritionLogs.length,
    averageReadiness,
  };

  const scoring = calculateWeeklyReviewScore({
    summary: review?.summary ?? autoSummary,
    confidence: review?.confidence ?? null,
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
  const client = await createSupabaseRequestClient();
  const service = new WeeklyReviewService(new SupabaseWeeklyReviewRepository(client));
  return service.getLatest(user.id);
}
