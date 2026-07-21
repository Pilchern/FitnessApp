import "server-only";

import { buildStrengthProgressionSummaries } from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import type { StrengthDetailData, StrengthPageData } from "./types";

function twoYearsAgoIsoDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 2);
  return date.toISOString().slice(0, 10);
}

export async function getStrengthPageData(
  editSessionId?: string,
): Promise<StrengthPageData> {
  const user = await requireCurrentUser();
  const { strengthService, trainingTemplateService } = await createCoreServices();

  const [sessions, strengthTemplates, editingSession] = await Promise.all([
    strengthService.listByDateRange({
      userId: user.id,
      startDate: twoYearsAgoIsoDate(),
    }),
    trainingTemplateService.listActiveStrengthTemplates({ userId: user.id }),
    editSessionId
      ? strengthService.getById(user.id, editSessionId)
      : Promise.resolve(null),
  ]);

  const knownExercises = [
    ...new Set(
      sessions.flatMap((s) => s.sets.map((set) => set.exerciseName))
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    sessions,
    progressionSummaries: buildStrengthProgressionSummaries(sessions),
    editingSession,
    formError:
      editSessionId && !editingSession
        ? "The strength session you tried to edit could not be found."
        : undefined,
    knownExercises,
    lastSession: sessions[0] ?? null,
    strengthTemplates,
  };
}

export async function getStrengthDetailData(
  sessionId: string,
): Promise<StrengthDetailData> {
  const user = await requireCurrentUser();
  const { strengthService } = await createCoreServices();
  const [session, sessions] = await Promise.all([
    strengthService.getById(user.id, sessionId),
    strengthService.listByDateRange({
      userId: user.id,
      startDate: twoYearsAgoIsoDate(),
    }),
  ]);

  const sessionExerciseNames = new Set(
    session?.sets.map((set: { exerciseName: string }) => set.exerciseName) ?? [],
  );
  const exerciseProgressionSummaries = buildStrengthProgressionSummaries(sessions).filter(
    (summary) => sessionExerciseNames.has(summary.exerciseName),
  );

  return {
    session,
    exerciseProgressionSummaries,
  };
}
