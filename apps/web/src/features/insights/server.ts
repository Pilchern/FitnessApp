import "server-only";

import {
  BodyMetricService,
  buildInsights,
  CardioSessionService,
  getTopInsights,
  getWeekRangeFromStart,
  RecoveryCheckinService,
  StrengthSessionSummaryService,
  WeeklyReviewService,
} from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseStrengthSessionSummaryRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createSupabaseRequestClient } from "@/lib/server/supabase";

async function createDependencies() {
  const client = await createSupabaseRequestClient();

  return {
    bodyMetricService: new BodyMetricService(new SupabaseBodyMetricRepository(client)),
    cardioService: new CardioSessionService(new SupabaseCardioSessionRepository(client)),
    recoveryService: new RecoveryCheckinService(
      new SupabaseRecoveryCheckinRepository(client),
    ),
    strengthSummaryService: new StrengthSessionSummaryService(
      new SupabaseStrengthSessionSummaryRepository(client),
    ),
    weeklyReviewService: new WeeklyReviewService(
      new SupabaseWeeklyReviewRepository(client),
    ),
  };
}

function sixMonthsAgoIsoDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

export async function getInsightsData() {
  const user = await requireCurrentUser();
  const {
    bodyMetricService,
    cardioService,
    recoveryService,
    strengthSummaryService,
    weeklyReviewService,
  } = await createDependencies();

  const startDate = sixMonthsAgoIsoDate();
  const weeklyReviews = await weeklyReviewService.listRecent(user.id, 8);
  const weekStarts = new Set<string>(weeklyReviews.map((review) => review.weekStart));
  const recentCardio = await cardioService.listByDateRange({
    userId: user.id,
    startDate,
  });
  const recentRecovery = await recoveryService.listByDateRange({
    userId: user.id,
    startDate,
  });
  const recentBody = await bodyMetricService.listByDateRange({
    userId: user.id,
    startDate,
  });

  const liftPairs = await Promise.all(
    [...weekStarts].map(async (weekStart) => {
      const { weekEnd } = getWeekRangeFromStart(weekStart);
      const count = await strengthSummaryService.countCompletedByDateRange({
        userId: user.id,
        startDate: weekStart,
        endDate: weekEnd,
      });
      return [weekStart, count] as const;
    }),
  );

  const insights = buildInsights({
    bodyMetrics: recentBody,
    cardioSessions: recentCardio,
    recoveryCheckins: recentRecovery,
    weeklyReviews,
    liftsCompletedByWeek: Object.fromEntries(liftPairs),
    now: new Date(),
  });

  return {
    insights,
    topInsights: getTopInsights(insights),
  };
}
