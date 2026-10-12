import type { RecoveryCheckin } from "@fitness-app/domain";

/**
 * Daily readiness: a 0-100 estimate of how recovered you are today, built the
 * way Oura and Whoop build theirs (today against your own recent baseline), but
 * from the data this app actually has: Apple Health HRV and resting heart rate,
 * last night's sleep, the 7-night sleep average, and an optional self-rating.
 *
 * It is a heuristic, not a validated measure. Each contributor is reported so
 * the number can be checked, and a day without enough baseline gets no score.
 *
 * Apple Health HRV is the day's SDNN average, not an overnight reading like
 * Oura or Whoop, so it is noisy. Robust statistics (median and MAD on ln HRV)
 * keep one odd reading from swinging the score.
 */

export type ReadinessComponentKey =
  | "hrv"
  | "restingHeartRate"
  | "sleep"
  | "sleepBalance";

export type ReadinessLevel = "good" | "fair" | "low";

export type ReadinessComponent = {
  key: ReadinessComponentKey;
  label: string;
  score: number;
  level: ReadinessLevel;
  detail: string;
};

export type DailyReadiness =
  | {
      status: "scored";
      /** The check-in date scored: today, or yesterday when today has not synced. */
      date: string;
      score: number;
      level: ReadinessLevel;
      components: ReadinessComponent[];
      /** Days of HRV in the baseline window; under 14 the baseline is still settling. */
      baselineDays: number;
      calibrating: boolean;
      /** Why the score was capped (high soreness, low self-rating); empty when not. */
      caps: string[];
    }
  | {
      status: "insufficient";
      date: string | null;
      reason: string;
    };

export type ReadinessOptions = {
  /** Sleep need in hours; last night and the 7-night average score against it. */
  sleepTargetHours?: number;
};

const BASELINE_WINDOW_DAYS = 30;
const MIN_BASELINE_DAYS = 5;
const SETTLED_BASELINE_DAYS = 14;
const DEFAULT_SLEEP_TARGET_HOURS = 8;
/** Score for a day exactly at baseline; each robust SD moves it by SCORE_PER_SD. */
const BASELINE_SCORE = 78;
const SCORE_PER_SD = 14;
/** Floors on the spread so a short, steady baseline does not over-react. */
const MIN_LN_HRV_SPREAD = 0.15;
const MIN_RHR_SPREAD_BPM = 3;
/** Points lost per hour of sleep short of the target. */
const SLEEP_POINTS_PER_HOUR = 25;
const CAPPED_SCORE = 49;

const WEIGHTS: Record<ReadinessComponentKey, number> = {
  hrv: 0.35,
  restingHeartRate: 0.25,
  sleep: 0.25,
  sleepBalance: 0.15,
};

export function readinessLevel(score: number): ReadinessLevel {
  if (score >= 75) return "good";
  if (score >= 55) return "fair";
  return "low";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Median and a robust SD (1.4826 x MAD), floored. */
function robustBaseline(values: number[], minSpread: number) {
  const center = median(values);
  const mad = median(values.map((v) => Math.abs(v - center)));
  return { center, spread: Math.max(1.4826 * mad, minSpread) };
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function hours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function component(
  key: ReadinessComponentKey,
  label: string,
  score: number,
  detail: string,
): ReadinessComponent {
  const clamped = clampScore(score);
  return { key, label, score: clamped, level: readinessLevel(clamped), detail };
}

function hasSignal(checkin: RecoveryCheckin) {
  return checkin.hrv != null || checkin.sleepDurationMinutes != null;
}

/**
 * Scores `today`, or yesterday when today's row has no sleep or HRV yet (the
 * overnight sync has not run). `checkins` should cover the 30 days before.
 */
export function computeDailyReadiness(
  checkins: RecoveryCheckin[],
  today: string,
  options: ReadinessOptions = {},
): DailyReadiness {
  const byDate = new Map(checkins.map((c) => [c.checkinDate, c]));
  const yesterday = addDays(today, -1);
  const todayRow = byDate.get(today);
  const day =
    todayRow && hasSignal(todayRow)
      ? todayRow
      : byDate.get(yesterday) && hasSignal(byDate.get(yesterday)!)
        ? byDate.get(yesterday)!
        : null;

  if (!day) {
    return {
      status: "insufficient",
      date: null,
      reason: "No sleep or HRV synced for last night yet.",
    };
  }

  return scoreDay(checkins, day, options);
}

function scoreDay(
  checkins: RecoveryCheckin[],
  day: RecoveryCheckin,
  options: ReadinessOptions,
): DailyReadiness {
  const sleepTarget = options.sleepTargetHours ?? DEFAULT_SLEEP_TARGET_HOURS;
  const windowStart = addDays(day.checkinDate, -BASELINE_WINDOW_DAYS);
  const prior = checkins.filter(
    (c) => c.checkinDate < day.checkinDate && c.checkinDate >= windowStart,
  );
  const priorHrv = prior
    .map((c) => c.hrv)
    .filter((v): v is number => v != null && v > 0);
  const priorRhr = prior
    .map((c) => c.restingHeartRate)
    .filter((v): v is number => v != null);

  const components: ReadinessComponent[] = [];

  if (day.hrv != null && day.hrv > 0 && priorHrv.length >= MIN_BASELINE_DAYS) {
    const base = robustBaseline(priorHrv.map(Math.log), MIN_LN_HRV_SPREAD);
    const z = (Math.log(day.hrv) - base.center) / base.spread;
    components.push(
      component(
        "hrv",
        "HRV",
        BASELINE_SCORE + SCORE_PER_SD * z,
        `${Math.round(day.hrv)} ms vs ${Math.round(Math.exp(base.center))} ms usual`,
      ),
    );
  }

  if (day.restingHeartRate != null && priorRhr.length >= MIN_BASELINE_DAYS) {
    const base = robustBaseline(priorRhr, MIN_RHR_SPREAD_BPM);
    const z = (day.restingHeartRate - base.center) / base.spread;
    components.push(
      component(
        "restingHeartRate",
        "Resting HR",
        BASELINE_SCORE - SCORE_PER_SD * z,
        `${day.restingHeartRate} bpm vs ${Math.round(base.center)} usual`,
      ),
    );
  }

  if (day.sleepDurationMinutes != null) {
    const slept = day.sleepDurationMinutes / 60;
    components.push(
      component(
        "sleep",
        "Sleep",
        100 - Math.max(0, sleepTarget - slept) * SLEEP_POINTS_PER_HOUR,
        `${hours(day.sleepDurationMinutes)} h of ${sleepTarget} h`,
      ),
    );
  }

  const weekStart = addDays(day.checkinDate, -6);
  const weekSleep = checkins
    .filter(
      (c) =>
        c.checkinDate >= weekStart &&
        c.checkinDate <= day.checkinDate &&
        c.sleepDurationMinutes != null,
    )
    .map((c) => c.sleepDurationMinutes!);
  if (weekSleep.length >= 3) {
    const avg = weekSleep.reduce((s, v) => s + v, 0) / weekSleep.length;
    components.push(
      component(
        "sleepBalance",
        "Sleep, 7 nights",
        100 - Math.max(0, sleepTarget - avg / 60) * SLEEP_POINTS_PER_HOUR,
        `${hours(avg)} h average`,
      ),
    );
  }

  const hasPhysiology = components.some(
    (c) => c.key === "hrv" || c.key === "restingHeartRate",
  );
  if (!hasPhysiology || components.length < 2) {
    const have = Math.max(priorHrv.length, priorRhr.length);
    return {
      status: "insufficient",
      date: day.checkinDate,
      reason:
        have < MIN_BASELINE_DAYS
          ? `Building your baseline: ${have} of ${MIN_BASELINE_DAYS} days of HRV and resting HR.`
          : "Last night's HRV and resting HR have not synced yet.",
    };
  }

  const totalWeight = components.reduce((s, c) => s + WEIGHTS[c.key], 0);
  let score = clampScore(
    components.reduce((s, c) => s + c.score * WEIGHTS[c.key], 0) / totalWeight,
  );

  const caps: string[] = [];
  if (day.sorenessLevel != null && day.sorenessLevel >= 8) {
    caps.push(`Soreness logged at ${day.sorenessLevel}/10`);
  }
  if (day.readinessLevel != null && day.readinessLevel <= 4) {
    caps.push(`You rated readiness ${day.readinessLevel}/10`);
  }
  if (caps.length > 0) score = Math.min(score, CAPPED_SCORE);

  return {
    status: "scored",
    date: day.checkinDate,
    score,
    level: readinessLevel(score),
    components,
    baselineDays: priorHrv.length,
    calibrating: priorHrv.length < SETTLED_BASELINE_DAYS,
    caps,
  };
}

/** Scores for each of the `days` dates ending at `today`; null where unscorable. */
export function buildReadinessHistory(
  checkins: RecoveryCheckin[],
  today: string,
  days = 7,
  options: ReadinessOptions = {},
): { date: string; score: number | null }[] {
  const byDate = new Map(checkins.map((c) => [c.checkinDate, c]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    const row = byDate.get(date);
    if (!row || !hasSignal(row)) return { date, score: null };
    const result = scoreDay(checkins, row, options);
    return { date, score: result.status === "scored" ? result.score : null };
  });
}
