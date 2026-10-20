import "server-only";

import {
  buildCardioWeeklyTotals,
  getCurrentWeekRangeForUser,
  templateWeekSchedule,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { weekPlanFromProgram } from "@/features/dashboard/helpers";
import { getProgramToday } from "@/features/program/server";
import { buildCardioTemplatePresets } from "./helpers";
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

  const [templates, sessions, editingSession, program] = await Promise.all([
    trainingTemplateService.listActiveCardioTemplates({ userId: user.id }),
    cardioService.listByDateRange({ userId: user.id }),
    editSessionId
      ? cardioService.getById(user.id, editSessionId)
      : Promise.resolve(null),
    // The program sets the week's Zone 2 target (same as the dashboard).
    // A load error shows no target rather than the template numbers.
    getProgramToday().then(
      (today) => ({ ok: true as const, today }),
      (error) => {
        console.error("Program failed to load for the cardio target", error);
        return { ok: false as const, today: null };
      },
    ),
  ]);
  const programToday = program.today;

  const currentWeekSessions = sessions.filter(
    (session) =>
      session.sessionDate >= weekStart && session.sessionDate <= weekEnd,
  );

  return {
    templates: buildCardioTemplatePresets(templates),
    sessions,
    weeklyTotals: buildCardioWeeklyTotals(currentWeekSessions),
    zone2TargetMinutes: !program.ok
      ? null
      : programToday
        ? weekPlanFromProgram(programToday.week, programToday.today)
            .zone2TargetMinutes
        : // No active program: the templates are the plan.
          templateWeekSchedule(templates).zone2TargetMinutes,
    editingSession,
    formError:
      editSessionId && !editingSession
        ? "The session you tried to edit could not be found."
        : undefined,
  };
}
