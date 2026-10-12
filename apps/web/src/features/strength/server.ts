import "server-only";

import {
  buildOverridesLookup,
  buildStrengthProgressionSummaries,
  computeMuscleGroupVolume,
  getZonedDate,
  resolveExercise,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { buildLastByExercise, exerciseKey, shiftIsoDate } from "./helpers";
import type { StrengthDetailData, StrengthPageData } from "./types";

const HISTORY_DAYS = 730;

/**
 * Today in the profile's timezone. `new Date().toISOString()` is the UTC date,
 * which rolls over at 7 PM Central and would pull tomorrow into "today".
 */
async function zonedToday(userId: string) {
  const profile = await getCachedUserProfile(userId);
  const zonedNow = getZonedDate(profile?.timezone || "UTC");
  return {
    today: zonedNow.toISOString().slice(0, 10),
    dayOfWeek: zonedNow.getUTCDay(),
  };
}

export async function getStrengthPageData(
  editSessionId?: string,
): Promise<StrengthPageData> {
  const user = await requireCurrentUser();
  const { strengthService, trainingTemplateService, exerciseOverrideService } =
    await createCoreServices();

  const { today, dayOfWeek: todayDayOfWeek } = await zonedToday(user.id);

  const [sessions, strengthTemplates, editingSession, exerciseOverrides] =
    await Promise.all([
      strengthService.listByDateRange({
        userId: user.id,
        startDate: shiftIsoDate(today, -HISTORY_DAYS),
      }),
      trainingTemplateService.listActiveStrengthTemplates({ userId: user.id }),
      editSessionId
        ? strengthService.getById(user.id, editSessionId)
        : Promise.resolve(null),
      exerciseOverrideService.listActive({ userId: user.id }),
    ]);

  const todaysScheduledTemplate =
    strengthTemplates.find((t) => t.scheduledDayOfWeek === todayDayOfWeek) ??
    null;

  const knownExercises = [
    ...new Set(sessions.flatMap((s) => s.sets.map((set) => set.exerciseName))),
  ].sort((a, b) => a.localeCompare(b));

  const overridesLookup = buildOverridesLookup(exerciseOverrides);
  const muscleGroupVolume = computeMuscleGroupVolume(
    sessions,
    // Seven calendar days including today, so one Mon/Wed/Fri week never
    // counts the same weekday twice.
    { startDate: shiftIsoDate(today, -6), endDate: today },
    overridesLookup,
  );
  const unclassifiedExerciseNames = knownExercises.filter(
    (name) => !resolveExercise(name, overridesLookup),
  );

  return {
    sessions,
    progressionSummaries: buildStrengthProgressionSummaries(sessions),
    editingSession,
    formError:
      editSessionId && !editingSession
        ? "The strength session you tried to edit could not be found."
        : undefined,
    knownExercises,
    // Skips a Watch-only session (no sets yet): "repeat last" needs sets.
    lastSession: sessions.find((s) => s.sets.length > 0) ?? null,
    strengthTemplates,
    muscleGroupVolume,
    exerciseOverrides,
    unclassifiedExerciseNames,
    todaysScheduledTemplate,
    lastByExercise: buildLastByExercise(sessions),
    latestCreatedAt: sessions.reduce<string | null>(
      (latest, s) =>
        latest == null || s.createdAt > latest ? s.createdAt : latest,
      null,
    ),
  };
}

export async function getStrengthDetailData(
  sessionId: string,
): Promise<StrengthDetailData> {
  const user = await requireCurrentUser();
  const { strengthService } = await createCoreServices();
  const { today } = await zonedToday(user.id);
  const [session, sessions] = await Promise.all([
    strengthService.getById(user.id, sessionId),
    strengthService.listByDateRange({
      userId: user.id,
      startDate: shiftIsoDate(today, -HISTORY_DAYS),
    }),
  ]);

  const sessionExerciseKeys = new Set(
    session?.sets.map((set: { exerciseName: string }) =>
      exerciseKey(set.exerciseName),
    ) ?? [],
  );
  const exerciseProgressionSummaries = buildStrengthProgressionSummaries(
    sessions,
  ).filter((summary) =>
    sessionExerciseKeys.has(exerciseKey(summary.exerciseName)),
  );

  return {
    session,
    exerciseProgressionSummaries,
  };
}
