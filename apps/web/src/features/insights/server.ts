import "server-only";

import {
  BodyMetricService,
  buildInsights,
  CardioSessionService,
  getTopInsights,
  getWeekRangeFromStart,
  RecoveryCheckinService,
  StrengthSessionSummaryService,
  UserProfileService,
  WeeklyReviewService,
} from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseStrengthSessionSummaryRepository,
  SupabaseUserProfileRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createSupabaseRequestClient } from "@/lib/server/supabase";

async function createDependencies() {
  const client = await createSupabaseRequestClient();

  return {
    bodyMetricService: new BodyMetricService(new SupabaseBodyMetricRepository(client)),
    cardioService: new CardioSessionService(new SupabaseCardioSessionRepository(client)),
    profileService: new UserProfileService(new SupabaseUserProfileRepository(client)),
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
    profileService,
    recoveryService,
    strengthSummaryService,
    weeklyReviewService,
  } = await createDependencies();

  const startDate = sixMonthsAgoIsoDate();
  const [profile, weeklyReviews, recentCardio, recentRecovery, recentBody] =
    await Promise.all([
      profileService.getByUserId(user.id),
      weeklyReviewService.listRecent(user.id, 8),
      cardioService.listByDateRange({ userId: user.id, startDate }),
      recoveryService.listByDateRange({ userId: user.id, startDate }),
      bodyMetricService.listByDateRange({ userId: user.id, startDate }),
    ]);
  const timezone = profile?.timezone || "UTC";
  const weekStarts = new Set<string>(weeklyReviews.map((review) => review.weekStart));

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
    timezone,
  });

  return {
    insights,
    topInsights: getTopInsights(insights),
  };
}
