import "server-only";
import { stepHabitCompletions } from "@fitness-app/application";
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
