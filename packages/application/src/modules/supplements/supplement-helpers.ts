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
