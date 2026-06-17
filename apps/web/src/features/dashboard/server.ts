import "server-only";

import {
  buildBodyMetricSummary,
  buildBodyWeightTrend,
  buildCardioWeeklyTotals,
  computeJournalStreak,
  getCurrentWeekRangeForUser,
  getRecoveryCoachingSuggestion,
  JournalEntryService,
  StrengthSessionService,
} from "@fitness-app/application";
import {
  SupabaseJournalEntryRepository,
  SupabaseStrengthSessionRepository,
} from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { getInsightsData } from "@/features/insights/server";
import type { DashboardData, GoalProgress, TodayNutrition, NutritionTargetsSnapshot } from "./types";

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

function computeGoalProgress(
  profile: { goalFatLoss: boolean; goalPreserveMuscle: boolean; goalImproveVo2: boolean } | null,
  recentBody: { measuredOn: string; weightLb: number | null }[],
  strengthSessions: { sessionDate: string; sets: { weight: number | null; reps: number | null }[] }[],
  cardioLast8Weeks: { sessionDate: string; sessionKind: string; zone2Minutes: number | null; durationMinutes: number | null }[],
): GoalProgress[] {
  if (!profile) return [];

  const now = new Date();

  function daysAgoStr(days: number) {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  const progress: GoalProgress[] = [];

  if (profile.goalFatLoss) {
    const cutoff = daysAgoStr(28);
    const sorted = [...recentBody]
      .filter((r) => r.weightLb != null)
      .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn));
    const latest = sorted[0] ?? null;
    const baseline = sorted.find((r) => r.measuredOn <= cutoff) ?? null;

    if (!latest || !baseline) {
      progress.push({
        label: "Fat loss",
        description: "Trending body weight down over time",
        trend: "insufficient_data",
        trendDetail: "Not enough data yet — keep logging",
      });
    } else {
      const delta = (latest.weightLb ?? 0) - (baseline.weightLb ?? 0);
      const absDelta = Math.abs(delta).toFixed(1);
      progress.push({
        label: "Fat loss",
        description: "Trending body weight down over time",
        trend: delta <= -0.5 ? "improving" : delta >= 1 ? "declining" : "maintaining",
        trendDetail: `${delta < 0 ? "down" : "up"} ${absDelta}lb in 4 weeks`,
      });
    }
  }

  if (profile.goalPreserveMuscle) {
    const thisMonthStart = daysAgoStr(30);
    const lastMonthStart = daysAgoStr(60);

    function sessionVolume(s: { sets: { weight: number | null; reps: number | null }[] }) {
      return s.sets.reduce(
        (sum, set) => sum + (set.weight != null && set.reps != null ? set.weight * set.reps : 0),
        0,
      );
    }

    const thisMonth = strengthSessions.filter((s) => s.sessionDate >= thisMonthStart);
    const lastMonth = strengthSessions.filter(
      (s) => s.sessionDate >= lastMonthStart && s.sessionDate < thisMonthStart,
    );
    const thisVol = thisMonth.reduce((sum, s) => sum + sessionVolume(s), 0);
    const lastVol = lastMonth.reduce((sum, s) => sum + sessionVolume(s), 0);

    if (thisMonth.length === 0 || lastMonth.length === 0) {
      progress.push({
        label: "Preserve muscle",
        description: "Maintaining strength training volume month over month",
        trend: "insufficient_data",
        trendDetail: "Not enough data yet — keep logging",
      });
    } else {
      const pct = lastVol > 0 ? ((thisVol - lastVol) / lastVol) * 100 : 0;
      progress.push({
        label: "Preserve muscle",
        description: "Maintaining strength training volume month over month",
        trend: pct >= 5 ? "improving" : pct <= -10 ? "declining" : "maintaining",
        trendDetail:
          pct >= 0
            ? `volume up ${pct.toFixed(0)}% vs last month`
            : `volume down ${Math.abs(pct).toFixed(0)}% vs last month`,
      });
    }
  }

  if (profile.goalImproveVo2) {
    const fourWeeksAgo = daysAgoStr(28);
    const eightWeeksAgo = daysAgoStr(56);
    const today = daysAgoStr(0);

    function rangeMinutes(
      sessions: typeof cardioLast8Weeks,
      from: string,
      to: string,
    ): number {
      return sessions
        .filter((s) => s.sessionDate >= from && s.sessionDate <= to)
        .reduce((sum, s) => {
          if (s.sessionKind === "zone2" || s.sessionKind === "vo2") {
            return sum + (s.zone2Minutes ?? s.durationMinutes ?? 0);
          }
          return sum;
        }, 0);
    }

    const thisMinutes = rangeMinutes(cardioLast8Weeks, fourWeeksAgo, today);
    const priorMinutes = rangeMinutes(cardioLast8Weeks, eightWeeksAgo, fourWeeksAgo);
    const thisPerWeek = thisMinutes / 4;
    const priorPerWeek = priorMinutes / 4;
    const delta = thisPerWeek - priorPerWeek;

    if (priorMinutes === 0 && thisMinutes === 0) {
      progress.push({
        label: "Improve VO2",
        description: "Increasing Zone 2 + VO2 cardio minutes per week",
        trend: "insufficient_data",
        trendDetail: "Not enough data yet — keep logging",
      });
    } else {
      const absDelta = Math.abs(delta).toFixed(0);
      progress.push({
        label: "Improve VO2",
        description: "Increasing Zone 2 + VO2 cardio minutes per week",
        trend: delta >= 20 ? "improving" : delta <= -20 ? "declining" : "maintaining",
        trendDetail:
          delta >= 0
            ? `up ${absDelta} min/week vs prior 4 weeks`
            : `down ${absDelta} min/week vs prior 4 weeks`,
      });
    }
  }

  return progress;
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
    nutritionService,
  } = await createCoreServices();

  const client = await createSupabaseRequestClient();
  const journalService = new JournalEntryService(new SupabaseJournalEntryRepository(client));

  const profile = await profileService.getByUserId(user.id);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const timezone = profile?.timezone || "UTC";
  const { weekStart, weekEnd } = getCurrentWeekRangeForUser(timezone, weekStartsOn);

  const today = formatIsoDate(new Date());

  const strengthService = new StrengthSessionService(
    new SupabaseStrengthSessionRepository(client),
  );

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
  const journalStreak = computeJournalStreak(journalEntries, today);
  const topInsights = insightData?.topInsights ?? [];

  const todayNutrition: TodayNutrition | null =
    nutritionLogs.length === 0
      ? null
      : {
          proteinHitDays: nutritionLogs.filter((l) => l.proteinHit === true).length,
          fiberTakenDays: nutritionLogs.filter((l) => l.fiberTaken === true).length,
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
      ? [...recentBody].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))[0]?.measuredOn ?? null
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
    latestBodyDate,
    weightTrend,
    recentReviews,
    latestReview,
    topInsights: topInsights.slice(0, 3),
    coachingSuggestion,
    journalStreak,
    goalProgress: computeGoalProgress(profile, recentBody, strengthSessions, cardioLast8Weeks),
    todayNutrition,
    nutritionTargets,
  };
}
