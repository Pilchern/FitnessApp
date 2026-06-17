import "server-only";

import { getWeekRangeFromStart } from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";

function sixMonthsAgoIsoDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

export async function getInsightsData() {
  const user = await requireCurrentUser();
  const { insightOrchestrator, ...services } = await createCoreServices();

  const startDate = sixMonthsAgoIsoDate();
  const [profile, weeklyReviews, recentCardio, recentRecovery, recentBody] =
    await Promise.all([
      services.profileService.getByUserId(user.id),
      services.weeklyReviewService.listRecent(user.id, 8),
      services.cardioService.listByDateRange({ userId: user.id, startDate }),
      services.recoveryService.listByDateRange({ userId: user.id, startDate }),
      services.bodyMetricService.listByDateRange({ userId: user.id, startDate }),
    ]);

  const timezone = profile?.timezone || "UTC";
  const weekStarts = new Set<string>(weeklyReviews.map((review) => review.weekStart));

  const liftPairs = await Promise.all(
    [...weekStarts].map(async (weekStart) => {
      const { weekEnd } = getWeekRangeFromStart(weekStart);
      const count = await services.strengthSummaryService.countCompletedByDateRange({
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
    liftsCompletedByWeek: Object.fromEntries(liftPairs),
    now: new Date(),
    timezone,
  });

  return { insights, topInsights: insights.slice(0, 3) };
}
