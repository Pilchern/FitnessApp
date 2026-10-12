import "server-only";

import { getZonedDate } from "@fitness-app/application";
import { formatZonedIsoDate } from "@/features/dashboard/helpers";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { routineForHabit, type Routine } from "@/lib/routines";

/** Today in the owner's timezone, the date habit ticks are logged against. */
export async function getOwnerToday(userId: string) {
  const profile = await getCachedUserProfile(userId);
  return formatZonedIsoDate(getZonedDate(profile?.timezone || "UTC"));
}

/** The habit a routine completes, and whether it is already done today. */
export async function getRoutineHabit(routine: Routine) {
  const user = await requireCurrentUser();
  const { supplementService, supplementLogService } =
    await createCoreServices();
  const today = await getOwnerToday(user.id);
  const [habits, todaysLogs] = await Promise.all([
    supplementService.listActive({ userId: user.id }),
    supplementLogService.listByDate({ userId: user.id, logDate: today }),
  ]);
  const habit =
    habits.find(
      (h) =>
        h.kind === "habit" && routineForHabit(h.name)?.slug === routine.slug,
    ) ?? null;
  return {
    habitId: habit?.id ?? null,
    doneToday:
      habit != null &&
      todaysLogs.some((log) => log.supplementId === habit.id && log.taken),
  };
}
