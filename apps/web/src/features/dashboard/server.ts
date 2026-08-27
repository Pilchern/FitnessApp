import "server-only";

import {
  buildBodyMetricSummary,
  buildBodyWeightTrend,
  buildCardioWeeklyTotals,
  buildOverridesLookup,
  computeJournalStreak,
  computeMuscleGroupVolume,
  getCurrentWeekRangeForUser,
  getRecoveryCoachingSuggestion,
  getZonedDate,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { getInsightsData } from "@/features/insights/server";
import { computeGoalProgress, formatZonedIsoDate } from "./helpers";
import type {
  DashboardData,
  TodayNutrition,
  NutritionTargetsSnapshot,
} from "./types";

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
    bodyMetricService,
    cardioService,
    recoveryService,
    strengthService,
    strengthSummaryService,
    weeklyReviewService,
    nutritionService,
    journalService,
    exerciseOverrideService,
  } = await createCoreServices();

  const profile = await getCachedUserProfile(user.id);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const timezone = profile?.timezone || "UTC";
  const { weekStart, weekEnd } = getCurrentWeekRangeForUser(
    timezone,
    weekStartsOn,
  );

  // "Now" in the user's timezone — the same basis as weekStart/weekEnd above.
  // A raw `new Date()` here would yield the UTC date, which for users west of
  // UTC flips to tomorrow in the early evening.
  const zonedNow = getZonedDate(timezone);
  const today = formatZonedIsoDate(zonedNow);

  const [
    cardioThisWeekResult,
    liftsCompletedResult,
    recentRecoveryResult,
    recentBodyResult,
    recentReviewsResult,
    insightDataResult,
    journalEntriesResult,
    todayNutritionResult,
    strengthSessionsResult,
    cardioLast8WeeksResult,
    exerciseOverridesResult,
  ] = await Promise.allSettled([
    cardioService.listByDateRange({
      userId: user.id,
      startDate: weekStart,
      endDate: weekEnd,
    }),
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
    journalService.listByDateRange({
      userId: user.id,
      startDate: daysAgoIsoDate(60),
    }),
    nutritionService.listByDateRange({
      userId: user.id,
      startDate: daysAgoIsoDate(7),
    }),
    strengthService.listByDateRange({
      userId: user.id,
      startDate: daysAgoIsoDate(60),
    }),
    cardioService.listByDateRange({
      userId: user.id,
      startDate: daysAgoIsoDate(56),
    }),
    exerciseOverrideService.listActive({ userId: user.id }),
  ]);

  const cardioThisWeek = settledOrNull(cardioThisWeekResult) ?? [];
  const liftsCompleted = settledOrNull(liftsCompletedResult) ?? 0;
  const recentRecovery = settledOrNull(recentRecoveryResult) ?? [];
  const recentBody = settledOrNull(recentBodyResult) ?? [];
  const recentReviews = settledOrNull(recentReviewsResult) ?? [];
  const insightData = settledOrNull(insightDataResult);
  const journalEntries = settledOrNull(journalEntriesResult) ?? [];
  const nutritionLogs = settledOrNull(todayNutritionResult) ?? [];
  const strengthSessions = settledOrNull(strengthSessionsResult) ?? [];
  const cardioLast8Weeks = settledOrNull(cardioLast8WeeksResult) ?? [];
  const exerciseOverrides = settledOrNull(exerciseOverridesResult) ?? [];
  const exerciseOverridesLookup = buildOverridesLookup(exerciseOverrides);
  const journalStreak = computeJournalStreak(journalEntries, today);
  const topInsights = insightData?.topInsights ?? [];

  const todayNutrition: TodayNutrition | null =
    nutritionLogs.length === 0
      ? null
      : {
          proteinHitDays: nutritionLogs.filter((l) => l.proteinHit === true)
            .length,
          fiberTakenDays: nutritionLogs.filter((l) => l.fiberTaken === true)
            .length,
          totalDays: nutritionLogs.length,
        };

  const nutritionTargets: NutritionTargetsSnapshot = {
    calories: profile?.dailyCaloriesTarget ?? null,
    proteinGrams: profile?.dailyProteinGramsTarget ?? null,
    fiberGrams: profile?.dailyFiberGramsTarget ?? null,
  };

  const cardioTotals = buildCardioWeeklyTotals(cardioThisWeek);
  const bodyMetricSummary = buildBodyMetricSummary(recentBody);
  const weightTrend = buildBodyWeightTrend(recentBody);
  const latestBodyDate =
    recentBody.length > 0
      ? ([...recentBody].sort((a, b) =>
          b.measuredOn.localeCompare(a.measuredOn),
        )[0]?.measuredOn ?? null)
      : null;

  // Count imported strength activities (WeightTraining, CrossFit, etc.) toward lifts
  const importedLifts = cardioThisWeek.filter(
    (s) => s.plannedVsCompleted === "completed" && s.sessionKind === "other",
  ).length;

  const sortedRecovery = [...recentRecovery].sort((a, b) =>
    b.checkinDate.localeCompare(a.checkinDate),
  );
  const latestRecovery = sortedRecovery[0] ?? null;
  const latestReview = recentReviews[0] ?? null;
  const coachingSuggestion = getRecoveryCoachingSuggestion(
    sortedRecovery.slice(0, 7),
  );
  const muscleGroupVolume = computeMuscleGroupVolume(
    strengthSessions,
    { startDate: daysAgoIsoDate(7), endDate: today },
    exerciseOverridesLookup,
  );

  return {
    trainingWeek: {
      weekStart,
      weekEnd,
      liftsCompleted: liftsCompleted + importedLifts,
      ridesCompleted: cardioThisWeek.filter(
        (s) =>
          s.plannedVsCompleted === "completed" && s.sessionKind !== "other",
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
    latestBodyDate,
    weightTrend,
    recentReviews,
    latestReview,
    topInsights: topInsights.slice(0, 3),
    coachingSuggestion,
    journalStreak,
    goalProgress: computeGoalProgress(
      profile,
      recentBody,
      strengthSessions,
      cardioLast8Weeks,
      { zonedNow },
    ),
    todayNutrition,
    nutritionTargets,
    muscleGroupVolume,
  };
}
