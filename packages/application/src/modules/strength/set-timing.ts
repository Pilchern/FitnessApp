/**
 * Session timing from per-set tick times (strength_exercise_sets.completed_at).
 * A gap is the time between two consecutive ticks, so it holds the rest plus
 * the next set's work. Span is first tick to last tick: it leaves out the
 * first set's own work and anything after the last tick.
 */
export type SetTiming = {
  /** Sets with a tick time. */
  timedSets: number;
  firstAt: string;
  lastAt: string;
  /** First tick to last tick, whole minutes. */
  spanMinutes: number;
  /** Gaps between consecutive ticks, seconds, in tick order. */
  gapsSeconds: number[];
  medianGapSeconds: number | null;
  longestGapSeconds: number | null;
  /** Gaps longer than LONG_GAP_SECONDS (a phone call, a break). */
  longGaps: number;
  /** Over the session cap, when a cap is given. */
  overCap: boolean;
};

export const LONG_GAP_SECONDS = 5 * 60;

function median(values: number[]) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export function setTiming(
  sets: { completedAt?: string | null }[],
  capMinutes?: number | null,
): SetTiming | null {
  const times = sets
    .map((s) => (s.completedAt ? Date.parse(s.completedAt) : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  const gapsSeconds = times
    .slice(1)
    .map((t, i) => Math.round((t - times[i]!) / 1000));
  const spanMinutes = Math.round(
    (times[times.length - 1]! - times[0]!) / 60000,
  );
  return {
    timedSets: times.length,
    firstAt: new Date(times[0]!).toISOString(),
    lastAt: new Date(times[times.length - 1]!).toISOString(),
    spanMinutes,
    gapsSeconds,
    medianGapSeconds: median(gapsSeconds),
    longestGapSeconds: Math.max(...gapsSeconds),
    longGaps: gapsSeconds.filter((g) => g > LONG_GAP_SECONDS).length,
    overCap: capMinutes != null && spanMinutes > capMinutes,
  };
}
