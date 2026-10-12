import "server-only";

import {
  buildCardioWeeklyTotals,
  getCurrentWeekRangeForUser,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { buildCardioTemplatePresets, sumWeeklyZone2Target } from "./helpers";
import type { CardioPageData } from "./types";

export async function getCardioPageData(
  editSessionId?: string,
): Promise<CardioPageData> {
  const user = await requireCurrentUser();
  const { cardioService, trainingTemplateService } = await createCoreServices();
  const profile = await getCachedUserProfile(user.id);
  const { weekStart, weekEnd } = getCurrentWeekRangeForUser(
    profile?.timezone || "UTC",
    profile?.weekStartsOn ?? 1,
  );

  const [templates, sessions, editingSession] = await Promise.all([
    trainingTemplateService.listActiveCardioTemplates({ userId: user.id }),
    cardioService.listByDateRange({ userId: user.id }),
    editSessionId
      ? cardioService.getById(user.id, editSessionId)
      : Promise.resolve(null),
  ]);

  const currentWeekSessions = sessions.filter(
    (session) =>
      session.sessionDate >= weekStart && session.sessionDate <= weekEnd,
  );

  return {
    templates: buildCardioTemplatePresets(templates),
    sessions,
    weeklyTotals: buildCardioWeeklyTotals(currentWeekSessions),
    zone2TargetMinutes: sumWeeklyZone2Target(templates),
    editingSession,
    formError:
      editSessionId && !editingSession
        ? "The session you tried to edit could not be found."
        : undefined,
  };
}
