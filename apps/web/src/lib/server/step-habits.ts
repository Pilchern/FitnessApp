import "server-only";
import {
  daylightHabitCompletions,
  stepHabitCompletions,
} from "@fitness-app/application";
import { createCoreServices } from "./services";

/**
 * Ticks the "N steps" habit for any synced day that reached N. Runs after an
 * Apple Health daily-metrics sync; a failure here is logged and swallowed so
 * the metrics themselves are never rejected because of the habit side effect.
 */
export async function completeStepHabits(
  userId: string,
  days: { date: string; steps?: number | null }[],
): Promise<number> {
  try {
    const { supplementService, supplementLogService } =
      await createCoreServices();
    const habits = await supplementService.listActive({ userId });
    const completions = stepHabitCompletions(habits, days);
    for (const completion of completions) {
      await supplementLogService.logAdherence({
        userId,
        supplementId: completion.supplementId,
        logDate: completion.logDate,
        taken: true,
      });
    }
    return completions.length;
  } catch (error) {
    console.error("[apple-health] step habit auto-complete failed:", error);
    return 0;
  }
}

/**
 * Ticks the morning sunlight habit for any day with enough daylight minutes
 * between 05:00 and 10:00 (hourly Time in Daylight from Health Auto Export).
 * Same failure handling as the step habit.
 */
export async function completeDaylightHabits(
  userId: string,
  days: { date: string; minutes: number }[],
): Promise<number> {
  if (days.length === 0) return 0;
  try {
    const { supplementService, supplementLogService } =
      await createCoreServices();
    const habits = await supplementService.listActive({ userId });
    const completions = daylightHabitCompletions(habits, days);
    for (const completion of completions) {
      await supplementLogService.logAdherence({
        userId,
        supplementId: completion.supplementId,
        logDate: completion.logDate,
        taken: true,
      });
    }
    return completions.length;
  } catch (error) {
    console.error("[apple-health] daylight habit auto-complete failed:", error);
    return 0;
  }
}
