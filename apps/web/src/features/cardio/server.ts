import "server-only";

import {
  buildCardioAdherenceSummary,
  buildCardioWeeklyTotals,
  getCurrentWeekRange,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import { buildCardioTemplatePresets } from "./helpers";
import type { CardioPageData } from "./types";

export async function getCardioPageData(
  editSessionId?: string,
): Promise<CardioPageData> {
  const user = await requireCurrentUser();
  const { cardioService, trainingTemplateService } = await createCoreServices();
  const weekRange = getCurrentWeekRange();

  const [templates, sessions, editingSession] = await Promise.all([
    trainingTemplateService.listActiveCardioTemplates({ userId: user.id }),
    cardioService.listByDateRange({ userId: user.id }),
    editSessionId ? cardioService.getById(user.id, editSessionId) : Promise.resolve(null),
  ]);

  const currentWeekSessions = sessions.filter(
    (session) =>
      session.sessionDate >= weekRange.startDate &&
      session.sessionDate <= weekRange.endDate,
  );

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
