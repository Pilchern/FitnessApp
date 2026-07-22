import "server-only";
import { cache } from "react";

import {
  AiInsightService,
  AiWeeklyReviewService,
  BodyMetricService,
  buildInsights,
  CardioSessionService,
  DailyActivityMetricService,
  InsightOrchestrator,
  JournalEntryService,
  NutritionLogService,
  NutritionTargetService,
  RecoveryCheckinService,
  StrengthSessionService,
  StrengthSessionSummaryService,
  SupplementLogService,
  SupplementService,
  TrainingTemplateService,
  UserProfileService,
  WeeklyReviewAutoFinalizeService,
  WeeklyReviewService,
} from "@fitness-app/application";
import type { AppSupabaseClient } from "@fitness-app/infrastructure";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseDailyActivityMetricRepository,
  SupabaseInsightRepository,
  SupabaseJournalEntryRepository,
  SupabaseNutritionLogRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseStrengthSessionRepository,
  SupabaseStrengthSessionSummaryRepository,
  SupabaseSupplementLogRepository,
  SupabaseSupplementRepository,
  SupabaseTrainingTemplateRepository,
  SupabaseUserProfileRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { getServerEnv } from "./env";
import { createSupabaseRequestClient } from "./supabase";

/**
 * THE composition root for the app (per AGENTS.md's Architecture Agent
 * guardrails): every feature module's service/repository wiring should go
 * through this function rather than hand-rolling
 * `new XService(new SupabaseXRepository(client))` locally.
 *
 * Pass an already-created client for contexts that need a specific one —
 * e.g. cron routes pass the admin client from createSupabaseAdminClient(),
 * since they run with no user session and must bypass RLS by design. When
 * omitted, this defaults to the cached, request-scoped client used by every
 * user-facing server action and page.
 *
 * Wrapped in React `cache()` so repeated calls within a single render tree
 * (e.g. dashboard/server.ts and insights/server.ts both call this today)
 * share one service graph instead of re-wiring it per call — this also
 * collapses the duplicate profile-fetch round trip between those two call
 * sites, since both now read from the same memoized `profileService`
 * instance/backing client. Safe to cache: nothing here is per-user state,
 * it's stateless service wrappers over repositories, and React `cache()` is
 * scoped to a single request (never shared across users/requests).
 */
export const createCoreServices = cache(async function createCoreServices(
  client?: AppSupabaseClient,
) {
  const resolvedClient = client ?? (await createSupabaseRequestClient());
  const env = getServerEnv();

  const aiInsightService = env.ANTHROPIC_API_KEY
    ? new AiInsightService({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.INSIGHT_AI_MODEL ?? "claude-haiku-4-5-20251001",
        enabled: env.INSIGHT_AI_ENABLED,
      })
    : null;

  const aiWeeklyReviewService = env.ANTHROPIC_API_KEY
    ? new AiWeeklyReviewService({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.INSIGHT_AI_MODEL ?? "claude-haiku-4-5-20251001",
        enabled: env.WEEKLY_REVIEW_AI_ENABLED,
      })
    : null;

  const insightRepository = new SupabaseInsightRepository(resolvedClient);
  const insightOrchestrator = new InsightOrchestrator(
    insightRepository,
    aiInsightService,
    buildInsights,
  );

  const profileRepository = new SupabaseUserProfileRepository(resolvedClient);
  const bodyMetricRepository = new SupabaseBodyMetricRepository(resolvedClient);

  const profileService = new UserProfileService(profileRepository);
  const bodyMetricService = new BodyMetricService(bodyMetricRepository);
  const cardioService = new CardioSessionService(
    new SupabaseCardioSessionRepository(resolvedClient),
  );
  const recoveryService = new RecoveryCheckinService(
    new SupabaseRecoveryCheckinRepository(resolvedClient),
  );
  const strengthService = new StrengthSessionService(
    new SupabaseStrengthSessionRepository(resolvedClient),
  );
  const strengthSummaryService = new StrengthSessionSummaryService(
    new SupabaseStrengthSessionSummaryRepository(resolvedClient),
  );
  const weeklyReviewService = new WeeklyReviewService(
    new SupabaseWeeklyReviewRepository(resolvedClient),
  );
  const nutritionService = new NutritionLogService(
    new SupabaseNutritionLogRepository(resolvedClient),
  );
  const nutritionTargetService = new NutritionTargetService(
    profileRepository,
    bodyMetricRepository,
  );
  const journalService = new JournalEntryService(
    new SupabaseJournalEntryRepository(resolvedClient),
  );
  const trainingTemplateService = new TrainingTemplateService(
    new SupabaseTrainingTemplateRepository(resolvedClient),
  );
  const supplementService = new SupplementService(
    new SupabaseSupplementRepository(resolvedClient),
  );
  const supplementLogService = new SupplementLogService(
    new SupabaseSupplementLogRepository(resolvedClient),
  );
  const dailyActivityService = new DailyActivityMetricService(
    new SupabaseDailyActivityMetricRepository(resolvedClient),
  );

  const weeklyReviewAutoFinalizeService = new WeeklyReviewAutoFinalizeService({
    weeklyReviewService,
    journalService,
    bodyMetricService,
    cardioService,
    recoveryService,
    strengthSummaryService,
    aiWeeklyReviewService,
  });

  return {
    profileService,
    bodyMetricService,
    cardioService,
    recoveryService,
    strengthService,
    strengthSummaryService,
    weeklyReviewService,
    nutritionService,
    nutritionTargetService,
    journalService,
    trainingTemplateService,
    supplementService,
    supplementLogService,
    dailyActivityService,
    insightRepository,
    insightOrchestrator,
    aiWeeklyReviewService,
    weeklyReviewAutoFinalizeService,
  };
});

/**
 * Dedupes the user profile fetch within a single request. Before this,
 * dashboard/server.ts's getDashboardData() and insights/server.ts's
 * getInsightsData() each independently called
 * `profileService.getByUserId(user.id)` — even though getDashboardData
 * calls getInsightsData() internally as part of the same request, this was
 * two separate round trips for the identical row. createCoreServices()
 * being cached only dedupes constructing the service graph, not the actual
 * query it issues, so this wraps the query itself the same way
 * getCurrentUser()/ensureProfileForUser() already do (see auth.ts /
 * profile-bootstrap.ts).
 */
export const getCachedUserProfile = cache(async function getCachedUserProfile(
  userId: string,
) {
  const { profileService } = await createCoreServices();
  return profileService.getByUserId(userId);
});
