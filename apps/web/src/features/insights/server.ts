import "server-only";

import {
  buildOverridesLookup,
  getWeekRangeFromStart,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";

function sixMonthsAgoIsoDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

/**
 * Read-only: the stored active insights, with no generation, no AI call and
 * no writes. The dashboard uses this, so Today never waits on the Anthropic
 * API or a six-month history read.
 */
export async function getActiveInsights() {
  const user = await requireCurrentUser();
  const { insightOrchestrator } = await createCoreServices();
  const insights = await insightOrchestrator.getActive(user.id);
  return { insights, topInsights: insights.slice(0, 3) };
}

/**
 * For /insights: regenerates when the last run is older than
 * INSIGHT_REFRESH_INTERVAL_MS (the Monday cron also generates), otherwise
 * returns the stored insights.
 */
export async function getInsightsData() {
  const user = await requireCurrentUser();
  const { insightOrchestrator, ...services } = await createCoreServices();

  if (!(await insightOrchestrator.isRefreshDue(user.id))) {
    return getActiveInsights();
  }

  const startDate = sixMonthsAgoIsoDate();
  const [
    profile,
    weeklyReviews,
    recentCardio,
    recentRecovery,
    recentBody,
    recentStrength,
    exerciseOverrides,
  ] = await Promise.all([
    getCachedUserProfile(user.id),
    services.weeklyReviewService.listRecent(user.id, 8),
    services.cardioService.listByDateRange({ userId: user.id, startDate }),
    services.recoveryService.listByDateRange({ userId: user.id, startDate }),
    services.bodyMetricService.listByDateRange({ userId: user.id, startDate }),
    services.strengthService.listByDateRange({ userId: user.id, startDate }),
    services.exerciseOverrideService.listActive({ userId: user.id }),
  ]);
  const exerciseOverridesLookup = buildOverridesLookup(exerciseOverrides);

  const timezone = profile?.timezone || "UTC";
  const weekStarts = new Set<string>(
    weeklyReviews.map((review) => review.weekStart),
  );

  const liftPairs = await Promise.all(
    [...weekStarts].map(async (weekStart) => {
      const { weekEnd } = getWeekRangeFromStart(weekStart);
      const count =
        await services.strengthSummaryService.countCompletedByDateRange({
          userId: user.id,
          startDate: weekStart,
          endDate: weekEnd,
        });
      return [weekStart, count] as const;
    }),
  );

  const insights = await insightOrchestrator.generateAndPersist({
    userId: user.id,
    bodyMetrics: recentBody,
    cardioSessions: recentCardio,
    recoveryCheckins: recentRecovery,
    weeklyReviews,
    strengthSessions: recentStrength,
    exerciseOverrides: exerciseOverridesLookup,
    liftsCompletedByWeek: Object.fromEntries(liftPairs),
    now: new Date(),
    timezone,
    weekStartsOn: profile?.weekStartsOn ?? 1,
  });

  return { insights, topInsights: insights.slice(0, 3) };
}
