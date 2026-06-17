import "server-only";

import {
  AiInsightService,
  BodyMetricService,
  buildInsights,
  CardioSessionService,
  InsightOrchestrator,
  NutritionLogService,
  RecoveryCheckinService,
  StrengthSessionSummaryService,
  UserProfileService,
  WeeklyReviewService,
} from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseInsightRepository,
  SupabaseNutritionLogRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseStrengthSessionSummaryRepository,
  SupabaseUserProfileRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { getServerEnv } from "./env";
import { createSupabaseRequestClient } from "./supabase";

/**
 * Wires the core set of services used by dashboard, weekly-review, and
 * any other server module that needs cross-domain data in a single request.
 * Pass an already-created client to avoid creating multiple Supabase instances.
 */
export async function createCoreServices() {
  const client = await createSupabaseRequestClient();
  const env = getServerEnv();

  const aiService = env.ANTHROPIC_API_KEY
    ? new AiInsightService({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.INSIGHT_AI_MODEL ?? "claude-haiku-4-5-20251001",
        enabled: env.INSIGHT_AI_ENABLED,
      })
    : null;

  const insightOrchestrator = new InsightOrchestrator(
    new SupabaseInsightRepository(client),
    aiService,
    buildInsights,
  );

  return {
    profileService: new UserProfileService(new SupabaseUserProfileRepository(client)),
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
    nutritionService: new NutritionLogService(
      new SupabaseNutritionLogRepository(client),
    ),
    insightOrchestrator,
  };
}
