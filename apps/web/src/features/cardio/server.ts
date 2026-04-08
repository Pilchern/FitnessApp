import "server-only";

import {
  buildCardioAdherenceSummary,
  buildCardioWeeklyTotals,
  CardioSessionService,
  TrainingTemplateService,
  getCurrentWeekRange,
} from "@fitness-app/application";
import {
  SupabaseCardioSessionRepository,
  SupabaseTrainingTemplateRepository,
} from "@fitness-app/infrastructure";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { requireCurrentUser } from "@/lib/server/auth";
import { buildCardioTemplatePresets } from "./helpers";
import type { CardioPageData } from "./types";

async function createDependencies() {
  const client = await createSupabaseRequestClient();

  return {
    cardioService: new CardioSessionService(
      new SupabaseCardioSessionRepository(client),
    ),
    trainingTemplateService: new TrainingTemplateService(
      new SupabaseTrainingTemplateRepository(client),
    ),
  };
}

export async function getCardioPageData(
  editSessionId?: string,
): Promise<CardioPageData> {
  const user = await requireCurrentUser();
  const { cardioService, trainingTemplateService } = await createDependencies();
  const weekRange = getCurrentWeekRange();

  const [templates, sessions, currentWeekSessions, editingSession] =
    await Promise.all([
      trainingTemplateService.listActiveCardioTemplates({ userId: user.id }),
      cardioService.listByDateRange({ userId: user.id }),
      cardioService.listByDateRange({
        userId: user.id,
        startDate: weekRange.startDate,
        endDate: weekRange.endDate,
      }),
      editSessionId ? cardioService.getById(user.id, editSessionId) : Promise.resolve(null),
    ]);

  return {
    templates: buildCardioTemplatePresets(templates),
    sessions,
    weeklyTotals: buildCardioWeeklyTotals(currentWeekSessions),
    adherence: buildCardioAdherenceSummary(currentWeekSessions, templates),
    editingSession,
    formError:
      editSessionId && !editingSession
        ? "The session you tried to edit could not be found."
        : undefined,
  };
}
