import "server-only";

import {
  buildBodyMetricSummary,
  buildCardioWeeklyTotals,
  buildReadinessHistory,
  buildTrainingLoad,
  buildPeerFitness,
  buildTrendNotes,
  buildWeeklyWeightTrend,
  computeDailyReadiness,
  getCurrentWeekRangeForUser,
  getZonedDate,
} from "@fitness-app/application";
import { NICK_TRAINING_PLAN } from "@/lib/training-plan";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { getInsightsData } from "@/features/insights/server";
import {
  addDaysIsoDate,
  buildWeekPlan,
  formatZonedIsoDate,
  readinessCall,
  summarizeDailyActivity,
} from "./helpers";
import type { DashboardData, TodayNutrition } from "./types";

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
    weeklyReviewService,
    nutritionService,
    trainingTemplateService,
    supplementService,
    supplementLogService,
    dailyActivityService,
  } = await createCoreServices();

  const profile = await getCachedUserProfile(user.id);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const timezone = profile?.timezone || "UTC";
  const { weekStart, weekEnd } = getCurrentWeekRangeForUser(
    timezone,
    weekStartsOn,
  );

  // "Today" in the user's timezone, the same basis as weekStart/weekEnd. A raw
  // `new Date()` would give the UTC date, which flips to tomorrow in the
  // evening for users west of UTC.
  const today = formatZonedIsoDate(getZonedDate(timezone));
  const daysAgo = (days: number) => addDaysIsoDate(today, -days);

  const [
    cardioThisWeekResult,
    recoveryResult,
    recentBodyResult,
    recentReviewsResult,
    insightDataResult,
    nutritionResult,
    strengthSessionsResult,
    cardioLast8WeeksResult,
    strengthTemplatesResult,
    cardioTemplatesResult,
    habitDefsResult,
    habitLogsResult,
    dailyActivityResult,
  ] = await Promise.allSettled([
    cardioService.listByDateRange({
      userId: user.id,
      startDate: weekStart,
      endDate: weekEnd,
    }),
    // 30-day readiness baseline before each of the last 7 days.
    recoveryService.listByDateRange({
      userId: user.id,
      startDate: daysAgo(37),
      endDate: today,
    }),
    bodyMetricService.listByDateRange({
      userId: user.id,
      startDate: daysAgo(90),
    }),
    weeklyReviewService.listRecent(user.id, 1),
    getInsightsData(),
    nutritionService.listByDateRange({
      userId: user.id,
      startDate: daysAgo(6),
      endDate: today,
    }),
    strengthService.listByDateRange({
      userId: user.id,
      startDate: daysAgo(90),
      endDate: today,
    }),
    cardioService.listByDateRange({
      userId: user.id,
      startDate: daysAgo(55),
      endDate: today,
    }),
    trainingTemplateService.listActiveStrengthTemplates({ userId: user.id }),
    trainingTemplateService.listActiveCardioTemplates({ userId: user.id }),
    supplementService.listActive({ userId: user.id }),
    supplementLogService.listByDateRange({
      userId: user.id,
      startDate: daysAgo(6),
      endDate: today,
    }),
    // A year, so the latest VO2 max estimate is found even when it is old.
    dailyActivityService.listByDateRange({
      userId: user.id,
      startDate: daysAgo(365),
      endDate: today,
    }),
  ]);

  const cardioThisWeek = settledOrNull(cardioThisWeekResult) ?? [];
  const recovery = settledOrNull(recoveryResult) ?? [];
  const recentBody = settledOrNull(recentBodyResult) ?? [];
  const latestReview = (settledOrNull(recentReviewsResult) ?? [])[0] ?? null;
  const insightData = settledOrNull(insightDataResult);
  const nutritionLogs = settledOrNull(nutritionResult) ?? [];
  const strengthSessions = settledOrNull(strengthSessionsResult) ?? [];
  const cardioLast8Weeks = settledOrNull(cardioLast8WeeksResult) ?? [];
  const habitItems = (settledOrNull(habitDefsResult) ?? []).filter(
    (s) => s.kind === "habit",
  );
  const habitLogs = settledOrNull(habitLogsResult) ?? [];
  const activity = summarizeDailyActivity(
    settledOrNull(dailyActivityResult) ?? [],
    today,
  );
  const planTemplates = [
    ...(settledOrNull(strengthTemplatesResult) ?? []),
    ...(settledOrNull(cardioTemplatesResult) ?? []),
  ];

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

  const bodyMetricSummary = buildBodyMetricSummary(recentBody);
  const latestBodyDate =
    [...recentBody]
      .filter((m) => m.weightLb != null)
      .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))[0]
      ?.measuredOn ?? null;

  const weekPlan = buildWeekPlan({
    weekStart,
    today,
    templates: planTemplates,
    strengthSessions,
    cardioSessions: cardioThisWeek,
  });
  const todayItems = weekPlan.days.find((d) => d.isToday)?.items ?? [];
  // Load needs the 28 days before each of the last 7: cardio covers 55 days,
  // strength 90.
  const readinessOptions = {
    trainingLoad: buildTrainingLoad(cardioLast8Weeks, strengthSessions),
  };
  const readiness = computeDailyReadiness(recovery, today, readinessOptions);

  const peerFitness = buildPeerFitness({
    today,
    birthDate: profile?.birthDate ?? null,
    sex: profile?.biologicalSex ?? null,
    vo2Max: activity.vo2Max,
    restingHeartRates: recovery
      .filter((c) => c.checkinDate > daysAgo(30) && c.restingHeartRate != null)
      .map((c) => c.restingHeartRate!),
  });

  return {
    today,
    readiness,
    peerFitness,
    readinessHistory: buildReadinessHistory(
      recovery,
      today,
      7,
      readinessOptions,
    ),
    readinessCall: readinessCall(
      readiness.status === "scored" ? readiness.level : null,
      todayItems,
    ),
    todayItems,
    zone2Minutes: buildCardioWeeklyTotals(cardioThisWeek).zone2Minutes,
    weekPlan,
    latestWeightLb: bodyMetricSummary.latestWeightLb,
    latestBodyFatPct: bodyMetricSummary.latestBodyFatPct,
    latestBodyDate,
    weeklyWeight: buildWeeklyWeightTrend(recentBody, today),
    proteinHit: todayNutrition
      ? { days: todayNutrition.proteinHitDays, of: todayNutrition.totalDays }
      : null,
    latestReview,
    topInsights: (insightData?.topInsights ?? []).slice(0, 2),
    trendNotes: buildTrendNotes({
      today,
      strengthSessions,
      cardioSessions: cardioLast8Weeks,
      bodyMetrics: recentBody,
      recovery,
      wakeTarget: NICK_TRAINING_PLAN.wakeTimeTarget ?? null,
    }),
    habits: {
      items: habitItems,
      takenTodayIds: habitLogs
        .filter((l) => l.taken && l.logDate === today)
        .map((l) => l.supplementId),
      weekCounts: Object.fromEntries(
        habitItems.map((h) => [
          h.id,
          habitLogs.filter((l) => l.taken && l.supplementId === h.id).length,
        ]),
      ),
      logDate: today,
    },
    activity,
  };
}
