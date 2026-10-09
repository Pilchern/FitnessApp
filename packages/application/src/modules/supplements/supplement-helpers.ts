import type { Supplement, SupplementLog } from "@fitness-app/domain";

export type SupplementAdherenceSummary = {
  supplementId: string;
  name: string;
  takenCount: number;
  loggedDayCount: number;
  adherencePct: number | null;
};

/**
 * Adherence % per supplement over the logs provided (typically a date-range
 * window, e.g. the trailing 30 days for a weekly review). `loggedDayCount`
 * only counts days that actually have a log row — days with no row are
 * "not tracked", not "missed", so they don't drag the percentage down.
 */
export function buildSupplementAdherenceSummary(
  supplements: Supplement[],
  logs: SupplementLog[],
): SupplementAdherenceSummary[] {
  return supplements.map((supplement) => {
    const supplementLogs = logs.filter(
      (log) => log.supplementId === supplement.id,
    );
    const takenCount = supplementLogs.filter((log) => log.taken).length;
    const loggedDayCount = supplementLogs.length;

    return {
      supplementId: supplement.id,
      name: supplement.name,
      takenCount,
      loggedDayCount,
      adherencePct:
        loggedDayCount > 0
          ? Math.round((takenCount / loggedDayCount) * 1000) / 10
          : null,
    };
  });
}

/**
 * Step target encoded in a habit's name: "7,000 steps" -> 7000. Returns null
 * for any habit that is not a step count, so renaming the habit to
 * "8,000 steps" moves the auto-complete threshold with no code change.
 */
export function stepHabitThreshold(name: string): number | null {
  const match = /(\d[\d,]*)\s*(k)?\s*steps\b/i.exec(name);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ""));
  const threshold = match[2] ? value * 1000 : value;
  return Number.isFinite(threshold) && threshold > 0 ? threshold : null;
}

/**
 * Habit logs to write when synced step counts reach a step habit's target.
 * Only ever marks a habit done; a day under target is left as it was so a
 * manual tick is never undone by a partial-day sync.
 */
export function stepHabitCompletions(
  habits: Pick<Supplement, "id" | "name" | "kind">[],
  days: { date: string; steps?: number | null }[],
): { supplementId: string; logDate: string }[] {
  const out: { supplementId: string; logDate: string }[] = [];
  for (const habit of habits) {
    if (habit.kind !== "habit") continue;
    const threshold = stepHabitThreshold(habit.name);
    if (threshold == null) continue;
    for (const day of days) {
      if (day.steps != null && day.steps >= threshold) {
        out.push({ supplementId: habit.id, logDate: day.date });
      }
    }
  }
  return out;
}
