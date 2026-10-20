import "server-only";

import {
  buildBodyMetricSummary,
  buildCardioWeeklyTotals,
  buildReadinessHistory,
  buildPeerFitness,
  buildDailyStrain,
  buildSleepPlan,
  maxHeartRateFor,
  MEASURED_MAX_HEART_RATE,
  ageOn,
  buildTrendNotes,
  buildWeeklyWeightTrend,
  computeDailyReadiness,
  getCurrentWeekRangeForUser,
  getZonedDate,
} from "@fitness-app/application";
import {
  EARLIEST_BEDTIME,
  NICK_TRAINING_PLAN,
  SLEEP_TARGET_HOURS,
} from "@/lib/training-plan";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { after } from "next/server";
import {
  getActiveInsights,
  refreshInsightsIfDue,
} from "@/features/insights/server";
import {
  addDaysIsoDate,
  buildWeekPlan,
  formatZonedIsoDate,
  readinessCall,
  summarizeDailyActivity,
} from "./helpers";
import type { DashboardData, StrainSleep, TodayNutrition } from "./types";

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
    getActiveInsights(),
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

  // Rendering stays read-only. Once the response is sent, regenerate if the
  // last run is an hour or more old, so the next load shows fresh insights
  // even when /insights is never opened.
  after(() =>
    refreshInsightsIfDue(user.id).catch((error) =>
      console.error("[dashboard] insight refresh", error),
    ),
  );

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
  const readinessOptions = { sleepTargetHours: SLEEP_TARGET_HOURS };
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

  const strainSleep = buildStrainSleep({
    today,
    daysAgo,
    birthDate: profile?.birthDate ?? null,
    sex: profile?.biologicalSex ?? null,
    restingHeartRates: recovery
      .filter((c) => c.checkinDate > daysAgo(30) && c.restingHeartRate != null)
      .map((c) => c.restingHeartRate!),
    cardio: cardioLast8Weeks,
    strength: strengthSessions,
    recovery,
  });

  const trendNotes = buildTrendNotes({
    today,
    strengthSessions,
    cardioSessions: cardioLast8Weeks,
    bodyMetrics: recentBody,
    recovery,
    wakeTarget: NICK_TRAINING_PLAN.wakeTimeTarget ?? null,
  });
  // Plan section 5: resting HR up 3+ bpm means hold bike progression.
  const holdProgression = trendNotes.some(
    (n) => n.key === "rhr" && n.tone === "attention",
  );

  return {
    today,
    readiness,
    peerFitness,
    strainSleep,
    readinessHistory: buildReadinessHistory(
      recovery,
      today,
      7,
      readinessOptions,
    ),
    readinessCall: readinessCall(
      readiness.status === "scored" ? readiness.level : null,
      todayItems,
      { holdProgression },
    ),
    todayItems,
    feelToday:
      recovery.find((c) => c.checkinDate === today)?.readinessLevel ?? null,
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
    trendNotes,
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

/**
 * Strain for today and the last few days (Banister TRIMP on average HR) and
 * the sleep plan that follows from it. Strain needs a birth date for max HR
 * and a week of resting HR; without them the sleep plan still runs, with no
 * strain allowance.
 */
function buildStrainSleep(input: {
  today: string;
  daysAgo: (days: number) => string;
  birthDate: string | null;
  sex: "male" | "female" | "unspecified" | null;
  restingHeartRates: number[];
  cardio: Parameters<typeof buildDailyStrain>[1];
  strength: Parameters<typeof buildDailyStrain>[2];
  recovery: Parameters<typeof buildSleepPlan>[0]["checkins"];
}): StrainSleep {
  const dates = Array.from({ length: 7 }, (_, i) => input.daysAgo(6 - i));
  const rhr = [...input.restingHeartRates].sort((a, b) => a - b);
  const restingHeartRate =
    rhr.length >= 7 ? rhr[Math.floor(rhr.length / 2)]! : null;
  // Measured max HR (the same one Zone 2 uses) wins over the age estimate.
  const maxHeartRate =
    MEASURED_MAX_HEART_RATE ??
    (input.birthDate
      ? maxHeartRateFor(ageOn(input.birthDate, input.today))
      : null);
  const strain =
    maxHeartRate != null && restingHeartRate != null
      ? buildDailyStrain(dates, input.cardio, input.strength, {
          restingHeartRate,
          maxHeartRate,
          sex: input.sex === "female" ? "female" : "male",
        })
      : null;
  const sleep = buildSleepPlan({
    checkins: input.recovery,
    today: input.today,
    sleepTargetHours: SLEEP_TARGET_HOURS,
    strainByDate: new Map((strain ?? []).map((d) => [d.date, d.strain])),
    wakeTarget: NICK_TRAINING_PLAN.wakeTimeTarget ?? null,
    earliestBedtime: EARLIEST_BEDTIME,
  });
  return {
    strain,
    missing:
      maxHeartRate == null
        ? "birth date"
        : restingHeartRate == null
          ? "a week of resting heart rate"
          : null,
    sleep,
  };
}
