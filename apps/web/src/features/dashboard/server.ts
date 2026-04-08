import "server-only";

import {
  buildBodyMetricSummary,
  buildBodyWeightTrend,
  buildCardioWeeklyTotals,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import { getInsightsData } from "@/features/insights/server";
import type { DashboardData } from "./types";

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentWeekStartEnd(weekStartsOn: 0 | 1 = 1): {
  weekStart: string;
  weekEnd: string;
} {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const daysSince = weekStartsOn === 1 ? (now.getDay() + 6) % 7 : now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - daysSince);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { weekStart: formatIsoDate(start), weekEnd: formatIsoDate(end) };
}

function daysAgoIsoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatIsoDate(date);
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
  const { weekStart, weekEnd } = getCurrentWeekStartEnd(weekStartsOn);

  const [
    cardioThisWeek,
    liftsCompleted,
    recentRecovery,
    recentBody,
    recentReviews,
    insightData,
  ] = await Promise.all([
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
    topInsights: insightData.topInsights.slice(0, 3),
  };
}
