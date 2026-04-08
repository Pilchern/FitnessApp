import "server-only";

import {
  BodyMetricService,
  CardioSessionService,
  NutritionLogService,
  RecoveryCheckinService,
  StrengthSessionSummaryService,
  UserProfileService,
  WeeklyReviewService,
} from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseNutritionLogRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseStrengthSessionSummaryRepository,
  SupabaseUserProfileRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { createSupabaseRequestClient } from "./supabase";

/**
 * Wires the core set of services used by dashboard, weekly-review, and
 * any other server module that needs cross-domain data in a single request.
 * Pass an already-created client to avoid creating multiple Supabase instances.
 */
export async function createCoreServices() {
  const client = await createSupabaseRequestClient();

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
  };
}
