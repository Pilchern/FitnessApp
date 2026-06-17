import "server-only";

import {
  buildBodyMetricSummary,
  buildBodyWeightTrend,
  buildCardioWeeklyTotals,
  getCurrentWeekRangeForUser,
  getRecoveryCoachingSuggestion,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import { getInsightsData } from "@/features/insights/server";
import type { DashboardData } from "./types";

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgoIsoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatIsoDate(date);
}

function settledOrNull<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

export async function getDashboardData(): Promise<DashboardData> {
  const user = await requireCurrentUser();
  const {
    profileService,
    bodyMetricService,
    cardioService,
    recoveryService,
    strengthSummaryService,
    weeklyReviewService,
  } = await createCoreServices();

  const profile = await profileService.getByUserId(user.id);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const timezone = profile?.timezone || "UTC";
  const { weekStart, weekEnd } = getCurrentWeekRangeForUser(timezone, weekStartsOn);

  const [
    cardioThisWeekResult,
    liftsCompletedResult,
    recentRecoveryResult,
    recentBodyResult,
    recentReviewsResult,
    insightDataResult,
  ] = await Promise.allSettled([
    cardioService.listByDateRange({ userId: user.id, startDate: weekStart, endDate: weekEnd }),
    strengthSummaryService.countCompletedByDateRange({
      userId: user.id,
      startDate: weekStart,
      endDate: weekEnd,
    }),
    recoveryService.listByDateRange({
      userId: user.id,
      startDate: daysAgoIsoDate(14),
    }),
    bodyMetricService.listByDateRange({
      userId: user.id,
      startDate: daysAgoIsoDate(90),
    }),
    weeklyReviewService.listRecent(user.id, 6),
    getInsightsData(),
  ]);

  const cardioThisWeek = settledOrNull(cardioThisWeekResult) ?? [];
  const liftsCompleted = settledOrNull(liftsCompletedResult) ?? 0;
  const recentRecovery = settledOrNull(recentRecoveryResult) ?? [];
  const recentBody = settledOrNull(recentBodyResult) ?? [];
  const recentReviews = settledOrNull(recentReviewsResult) ?? [];
  const insightData = settledOrNull(insightDataResult);
  const topInsights = insightData?.topInsights ?? [];

  const cardioTotals = buildCardioWeeklyTotals(cardioThisWeek);
  const bodyMetricSummary = buildBodyMetricSummary(recentBody);
  const weightTrend = buildBodyWeightTrend(recentBody);

  // Count imported strength activities (WeightTraining, CrossFit, etc.) toward lifts
  const importedLifts = cardioThisWeek.filter(
    (s) => s.plannedVsCompleted === "completed" && s.sessionKind === "other",
  ).length;

  const sortedRecovery = [...recentRecovery].sort((a, b) =>
    b.checkinDate.localeCompare(a.checkinDate),
  );
  const latestRecovery = sortedRecovery[0] ?? null;
  const latestReview = recentReviews[0] ?? null;
  const coachingSuggestion = getRecoveryCoachingSuggestion(sortedRecovery.slice(0, 7));

  return {
    trainingWeek: {
      weekStart,
      weekEnd,
      liftsCompleted: liftsCompleted + importedLifts,
      ridesCompleted: cardioThisWeek.filter(
        (s) => s.plannedVsCompleted === "completed" && s.sessionKind !== "other",
      ).length,
      zone2Minutes: cardioTotals.zone2Minutes,
      totalMinutes: cardioTotals.totalMinutes,
    },
    latestRecovery,
    latestWeightLb: bodyMetricSummary.latestWeightLb,
    weightChangeLb: bodyMetricSummary.weightChangeLb,
    latestWaistIn: bodyMetricSummary.latestWaistIn,
    waistChangeIn: bodyMetricSummary.waistChangeIn,
    latestBodyFatPct: bodyMetricSummary.latestBodyFatPct,
    weightTrend,
    recentReviews,
    latestReview,
    topInsights: topInsights.slice(0, 3),
    coachingSuggestion,
  };
}
