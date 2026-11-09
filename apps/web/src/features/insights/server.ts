import "server-only";

import {
  buildOverridesLookup,
  getWeekRangeFromStart,
  type PersistedInsight,
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
 * no writes. The dashboard renders from this, so Today never waits on the
 * Anthropic API or a six-month history read.
 */
export async function getActiveInsights() {
  const user = await requireCurrentUser();
  const { insightOrchestrator } = await createCoreServices();
  const insights = await insightOrchestrator.getActive(user.id);
  return { insights, topInsights: insights.slice(0, 3) };
}

/**
 * Regenerates insights when the last run is INSIGHT_REFRESH_INTERVAL_MS or
 * older: loads six months of history and runs generateAndPersist (rules, the
 * gated AI call, upserts and retires). Returns the fresh active insights, or
 * null when no refresh was due. Called during the /insights render and from
 * the dashboard's after() hook, once the Today response has been sent.
 */
export async function refreshInsightsIfDue(
  userId: string,
): Promise<PersistedInsight[] | null> {
  const { insightOrchestrator, ...services } = await createCoreServices();

  if (!(await insightOrchestrator.isRefreshDue(userId))) {
    return null;
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
    getCachedUserProfile(userId),
    services.weeklyReviewService.listRecent(userId, 8),
    services.cardioService.listByDateRange({ userId, startDate }),
    services.recoveryService.listByDateRange({ userId, startDate }),
    services.bodyMetricService.listByDateRange({ userId, startDate }),
    services.strengthService.listByDateRange({ userId, startDate }),
    services.exerciseOverrideService.listActive({ userId }),
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
          userId,
          startDate: weekStart,
          endDate: weekEnd,
        });
      return [weekStart, count] as const;
    }),
  );

  return insightOrchestrator.generateAndPersist({
    userId,
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
}

/** For /insights: refreshes first when due, else the stored insights. */
export async function getInsightsData() {
  const user = await requireCurrentUser();
  const refreshed = await refreshInsightsIfDue(user.id);
  if (!refreshed) {
    return getActiveInsights();
  }
  return { insights: refreshed, topInsights: refreshed.slice(0, 3) };
}
