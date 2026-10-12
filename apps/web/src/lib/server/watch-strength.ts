import "server-only";
import type { WatchStrengthWorkout } from "@fitness-app/application";
import { createCoreServices } from "./services";

/**
 * Merges Apple Watch strength workouts into the day's lift session (or
 * records a Watch-only one). Runs after an Apple Health sync; a failure is
 * logged and swallowed so the rest of the export is never rejected because
 * of it.
 */
export async function syncWatchStrength(
  userId: string,
  workouts: WatchStrengthWorkout[],
): Promise<number> {
  if (workouts.length === 0) return 0;
  try {
    const { watchStrengthSyncService } = await createCoreServices();
    const result = await watchStrengthSyncService.sync(userId, workouts);
    return result.patched + result.created;
  } catch (error) {
    console.error("[apple-health] Watch strength merge failed:", error);
    return 0;
  }
}
