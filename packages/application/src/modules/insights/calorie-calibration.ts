import type {
  BodyMetric,
  Insight,
  IsoDate,
  NutritionLog,
  StrengthSession,
} from "@fitness-app/domain";

/**
 * Weekly calorie calibration (post-DEXA plan). From 2026-11-14, every 7 days,
 * compare the Withings 7-day average now with 3 weeks earlier against the
 * average logged kcal:
 *   losing more than 0.5 lb/wk          -> raise 150-200 kcal
 *   gaining more than 0.25 lb/wk, lifts flat -> cut 150
 *   otherwise                            -> hold
 * Skipped (and the insight says so) when fewer than 5 of the last 7 days
 * have calories logged, or there are too few weigh-ins to read a trend.
 *
 * Every window ends the day before the check date, so the result is fixed
 * for the week no matter when the engine runs.
 */

export const CALIBRATION_START: IsoDate = "2026-11-14";
export const CALIBRATION_MIN_LOGGED_DAYS = 5;
export const CALIBRATION_MIN_WEIGH_INS = 3;
const LOSS_LIMIT_LB_WK = -0.5;
const GAIN_LIMIT_LB_WK = 0.25;

function shift(date: IsoDate, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function daysFrom(a: IsoDate, b: IsoDate) {
  return Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000,
  );
}

function round(value: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/** The latest check date (2026-11-14 + 7k) on or before `today`, else null. */
export function calibrationCheckDate(today: IsoDate): IsoDate | null {
  const days = daysFrom(CALIBRATION_START, today);
  if (days < 0) return null;
  return shift(CALIBRATION_START, days - (days % 7));
}

function weightAverage(
  body: Pick<BodyMetric, "measuredOn" | "weightLb" | "source">[],
  start: IsoDate,
  end: IsoDate,
) {
  const values = body
    .filter(
      (m) =>
        m.source.sourceType !== "manual" &&
        m.weightLb != null &&
        m.measuredOn >= start &&
        m.measuredOn <= end,
    )
    .map((m) => m.weightLb as number);
  return {
    avg:
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
    count: values.length,
  };
}

/** Heaviest working set per exercise in the date range. */
function topLoads(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  start: IsoDate,
  end: IsoDate,
) {
  const tops = new Map<string, number>();
  for (const s of sessions) {
    if (s.sessionDate < start || s.sessionDate > end) continue;
    for (const set of s.sets) {
      if (set.isWarmup || set.weight == null || !(set.weight > 0)) continue;
      const key = set.exerciseName.trim().toLowerCase();
      tops.set(key, Math.max(tops.get(key) ?? 0, set.weight));
    }
  }
  return tops;
}

/**
 * "Flat lifts": no exercise done both in the last week and three weeks ago
 * has a heavier top working set now. Null when no exercise is in both.
 */
export function liftsFlat(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  checkDate: IsoDate,
): boolean | null {
  const recent = topLoads(sessions, shift(checkDate, -7), shift(checkDate, -1));
  const earlier = topLoads(
    sessions,
    shift(checkDate, -21),
    shift(checkDate, -15),
  );
  const common = [...recent.keys()].filter((k) => earlier.has(k));
  if (common.length === 0) return null;
  return common.every((k) => (recent.get(k) ?? 0) <= (earlier.get(k) ?? 0));
}

export type CalibrationCall = "raise" | "cut" | "hold" | "skipped";

export type CalorieCalibration = {
  checkDate: IsoDate;
  call: CalibrationCall;
  loggedDays: number;
  weighIns: { recent: number; earlier: number };
  /** lb per week over the 3 weeks; negative is a loss. */
  trendLbPerWeek: number | null;
  recentAvgLb: number | null;
  earlierAvgLb: number | null;
  avgKcal: number | null;
  liftsFlat: boolean | null;
  reason: string;
};

export function calorieCalibration(input: {
  today: IsoDate;
  bodyMetrics: Pick<BodyMetric, "measuredOn" | "weightLb" | "source">[];
  nutritionLogs: Pick<NutritionLog, "logDate" | "calories">[];
  strengthSessions: Pick<StrengthSession, "sessionDate" | "sets">[];
}): CalorieCalibration | null {
  const checkDate = calibrationCheckDate(input.today);
  if (!checkDate) return null;
  const end = shift(checkDate, -1);

  const logged = (start: IsoDate) =>
    input.nutritionLogs.filter(
      (l) => l.calories != null && l.logDate >= start && l.logDate <= end,
    );
  const lastWeek = new Set(logged(shift(checkDate, -7)).map((l) => l.logDate));
  const threeWeeks = logged(shift(checkDate, -21));
  const avgKcal =
    threeWeeks.length > 0
      ? Math.round(
          threeWeeks.reduce((a, l) => a + (l.calories as number), 0) /
            threeWeeks.length,
        )
      : null;

  const recent = weightAverage(input.bodyMetrics, shift(checkDate, -7), end);
  const earlierEnd = shift(end, -21);
  const earlier = weightAverage(
    input.bodyMetrics,
    shift(earlierEnd, -6),
    earlierEnd,
  );
  const trend =
    recent.avg != null && earlier.avg != null
      ? round((recent.avg - earlier.avg) / 3, 2)
      : null;
  const flat = liftsFlat(input.strengthSessions, checkDate);

  const base = {
    checkDate,
    loggedDays: lastWeek.size,
    weighIns: { recent: recent.count, earlier: earlier.count },
    trendLbPerWeek: trend,
    recentAvgLb: recent.avg != null ? round(recent.avg, 1) : null,
    earlierAvgLb: earlier.avg != null ? round(earlier.avg, 1) : null,
    avgKcal,
    liftsFlat: flat,
  };

  if (lastWeek.size < CALIBRATION_MIN_LOGGED_DAYS) {
    return {
      ...base,
      call: "skipped",
      reason: `Only ${lastWeek.size} of the last 7 days were logged in Cronometer; the check needs ${CALIBRATION_MIN_LOGGED_DAYS}.`,
    };
  }
  if (
    trend == null ||
    recent.count < CALIBRATION_MIN_WEIGH_INS ||
    earlier.count < CALIBRATION_MIN_WEIGH_INS
  ) {
    return {
      ...base,
      call: "skipped",
      reason: `Too few Withings weigh-ins to read a 3-week trend (${recent.count} this week, ${earlier.count} three weeks ago; needs ${CALIBRATION_MIN_WEIGH_INS} each).`,
    };
  }
  const rate = `${trend > 0 ? "+" : ""}${trend.toFixed(2)} lb/wk`;
  if (trend < LOSS_LIMIT_LB_WK) {
    return {
      ...base,
      call: "raise",
      reason: `Losing ${rate} over 3 weeks, faster than 0.5 lb/wk.`,
    };
  }
  if (trend > GAIN_LIMIT_LB_WK && flat === true) {
    return {
      ...base,
      call: "cut",
      reason: `Gaining ${rate} over 3 weeks with no top-set increase on any repeated lift.`,
    };
  }
  return {
    ...base,
    call: "hold",
    reason:
      trend > GAIN_LIMIT_LB_WK
        ? flat === false
          ? `Gaining ${rate}, but lifts are going up.`
          : `Gaining ${rate}; no repeated lift to judge progress, so hold.`
        : `Trend ${rate} is within -0.5 to +0.25 lb/wk.`,
  };
}

const TEXT: Record<
  CalibrationCall,
  { title: string; severity: Insight["severity"]; action: string }
> = {
  raise: {
    title: "Calories: raise 150-200 kcal",
    severity: "caution",
    action:
      "Raise kcal 150-200 a day, mostly carbs around lifts. Recheck next week.",
  },
  cut: {
    title: "Calories: cut 150 kcal",
    severity: "caution",
    action: "Cut 150 kcal a day from carbs or fat. Keep protein at 200 g.",
  },
  hold: {
    title: "Calories: hold",
    severity: "info",
    action: "Hold intake where it is. Recheck next week.",
  },
  skipped: {
    title: "Calorie check skipped",
    severity: "info",
    action:
      "Log at least 5 days in Cronometer and import them before the next check.",
  },
};

/** The week's calibration as an insight row (one per check date). */
export function calorieCalibrationInsight(
  result: CalorieCalibration | null,
): Insight | null {
  if (!result) return null;
  const t = TEXT[result.call];
  const kcal =
    result.avgKcal != null ? ` Average logged: ${result.avgKcal} kcal.` : "";
  const weights =
    result.recentAvgLb != null && result.earlierAvgLb != null
      ? ` Withings 7-day average ${result.earlierAvgLb} -> ${result.recentAvgLb} lb.`
      : "";
  return {
    id: `calorie_calibration:${result.checkDate}`,
    insightDate: result.checkDate,
    insightType: "calorie_calibration",
    title: t.title,
    severity: t.severity,
    explanation: `${result.reason}${weights}${kcal}`,
    recommendedNextAction: t.action,
    evidence: { ...result },
    sourceKind: "rule",
  };
}
