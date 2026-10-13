import type {
  CardioSession,
  RecoveryCheckin,
  StrengthSession,
} from "@fitness-app/domain";

/**
 * Daily readiness: a 0-100 estimate of how recovered you are today, built the
 * way Oura and Whoop build theirs (today against your own recent baseline).
 *
 * How the number is made:
 * 1. Core signals become z-scores against your prior 30 days: HRV and heart
 *    rate (overnight readings when synced, else Apple's daily HRV and resting
 *    HR), last night's sleep and the 7-night average against the sleep target
 *    (credit above the target is capped), and wake-time consistency.
 * 2. Their weighted mean maps to the score: a day exactly at baseline is 70,
 *    and SCORE_PER_Z points per unit. Simulated with your sleep spread (8.2 h,
 *    +/- 0.7) and assumed signal correlations, 90+ lands on about 8% of days
 *    and 100 on about 1%, before penalties and the calibration cap.
 * 3. Penalties that only ever subtract: wrist temperature above baseline,
 *    breathing rate above baseline, and a training-load spike (last 7 days
 *    against the 4-week average).
 * 4. Caps: soreness 8+ or a self-rating of 4 or less caps at 49. 100 needs
 *    every core signal at or above baseline, no penalty, and a settled
 *    baseline; a calibrating baseline tops out at 95.
 *
 * It is a heuristic, not a validated measure. Each contributor is reported so
 * the number can be checked, and a day without enough baseline gets no score.
 * Robust statistics (median and MAD, ln for HRV) keep one odd reading from
 * swinging the baseline.
 */

export type ReadinessComponentKey =
  | "hrv"
  | "restingHeartRate"
  | "sleep"
  | "sleepBalance"
  | "wakeConsistency";

export type ReadinessAdjustmentKey =
  | "wristTemperature"
  | "respiratoryRate"
  | "trainingLoad";

export type ReadinessLevel = "good" | "fair" | "low";

export type ReadinessComponent = {
  key: ReadinessComponentKey;
  label: string;
  score: number;
  level: ReadinessLevel;
  detail: string;
};

/** A penalty subtracted from the score; `points` is positive. */
export type ReadinessAdjustment = {
  key: ReadinessAdjustmentKey;
  label: string;
  points: number;
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
      adjustments: ReadinessAdjustment[];
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

/** Training load for one day, in RPE x minutes (Foster session-RPE). */
export type TrainingLoadDay = { date: string; load: number };

export type ReadinessOptions = {
  /** Sleep need in hours; last night and the 7-night average score against it. */
  sleepTargetHours?: number;
  /** Daily training load covering at least the 28 days before the scored day. */
  trainingLoad?: TrainingLoadDay[];
};

const BASELINE_WINDOW_DAYS = 30;
const MIN_BASELINE_DAYS = 5;
const SETTLED_BASELINE_DAYS = 14;
const DEFAULT_SLEEP_TARGET_HOURS = 8;
/** Score for a day exactly at baseline; each unit of weighted z adds SCORE_PER_Z. */
const BASELINE_SCORE = 70;
const SCORE_PER_Z = 22;
/** Floors on the spread so a short, steady baseline does not over-react. */
const MIN_LN_HRV_SPREAD = 0.15;
const MIN_HR_SPREAD_BPM = 3;
const MIN_RESPIRATORY_SPREAD = 0.5;
/** Sleep z: hours from target over these spreads, capped at +1. */
const SLEEP_SPREAD_HOURS = 0.75;
const SLEEP_BALANCE_SPREAD_HOURS = 0.4;
/** Wake-time SD at which consistency is neutral, and minutes per z. */
const WAKE_SD_NEUTRAL_MIN = 45;
const WAKE_SD_PER_Z_MIN = 20;
const CAPPED_SCORE = 49;
const CALIBRATING_MAX_SCORE = 95;

const WEIGHTS: Record<ReadinessComponentKey, number> = {
  hrv: 0.35,
  restingHeartRate: 0.2,
  sleep: 0.2,
  sleepBalance: 0.1,
  wakeConsistency: 0.15,
};

/** Default session RPE when none was logged, by cardio kind. */
const DEFAULT_CARDIO_RPE = { zone2: 4, recovery: 2, vo2: 8, other: 5 } as const;
const DEFAULT_STRENGTH_RPE = 6;
const DEFAULT_STRENGTH_MINUTES = 60;

export function readinessLevel(score: number): ReadinessLevel {
  if (score >= 67) return "good";
  if (score >= 50) return "fair";
  return "low";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

/** "06:42" -> 402. */
function clockMinutes(value: string | null): number | null {
  const match = value ? /^(\d{1,2}):(\d{2})/.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function present(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v));
}

function component(
  key: ReadinessComponentKey,
  label: string,
  z: number,
  detail: string,
): ReadinessComponent & { z: number } {
  const score = clampScore(BASELINE_SCORE + SCORE_PER_Z * z);
  return { key, label, score, level: readinessLevel(score), detail, z };
}

function hasSignal(checkin: RecoveryCheckin) {
  return (
    checkin.hrv != null ||
    checkin.sleepHrvAvg != null ||
    checkin.sleepDurationMinutes != null
  );
}

/**
 * Daily load in RPE x minutes. Cardio uses the logged RPE, else a default by
 * kind; strength has no session RPE, so it counts as a moderate 6.
 */
export function buildTrainingLoad(
  cardioSessions: Pick<
    CardioSession,
    | "sessionDate"
    | "sessionKind"
    | "durationMinutes"
    | "rpe"
    | "plannedVsCompleted"
  >[],
  strengthSessions: Pick<StrengthSession, "sessionDate" | "durationMinutes">[],
): TrainingLoadDay[] {
  const byDate = new Map<string, number>();
  const add = (date: string, load: number) =>
    byDate.set(date, (byDate.get(date) ?? 0) + load);

  for (const session of cardioSessions) {
    if (
      session.plannedVsCompleted === "planned" ||
      session.plannedVsCompleted === "skipped" ||
      !session.durationMinutes
    ) {
      continue;
    }
    const rpe = session.rpe ?? DEFAULT_CARDIO_RPE[session.sessionKind];
    add(session.sessionDate, rpe * session.durationMinutes);
  }
  for (const session of strengthSessions) {
    const minutes = session.durationMinutes ?? DEFAULT_STRENGTH_MINUTES;
    add(session.sessionDate, DEFAULT_STRENGTH_RPE * minutes);
  }

  return [...byDate.entries()]
    .map(([date, load]) => ({ date, load }))
    .sort((a, b) => a.date.localeCompare(b.date));
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

/**
 * Picks the overnight reading when today has one and the baseline has enough
 * of them, else the daily reading. Never mixes the two in one comparison.
 */
function pickSeries(
  day: RecoveryCheckin,
  prior: RecoveryCheckin[],
  overnight: (c: RecoveryCheckin) => number | null,
  daily: (c: RecoveryCheckin) => number | null,
) {
  const overnightPrior = present(prior.map(overnight));
  const today = overnight(day);
  if (today != null && overnightPrior.length >= MIN_BASELINE_DAYS) {
    return { today, prior: overnightPrior, overnight: true };
  }
  return {
    today: daily(day),
    prior: present(prior.map(daily)),
    overnight: false,
  };
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
  const positive = (v: number | null) => (v != null && v > 0 ? v : null);

  const hrv = pickSeries(
    day,
    prior,
    (c) => positive(c.sleepHrvAvg),
    (c) => positive(c.hrv),
  );
  const heartRate = pickSeries(
    day,
    prior,
    (c) => positive(c.sleepAvgHeartRate),
    (c) => c.restingHeartRate,
  );

  const components: (ReadinessComponent & { z: number })[] = [];

  if (hrv.today != null && hrv.prior.length >= MIN_BASELINE_DAYS) {
    const base = robustBaseline(hrv.prior.map(Math.log), MIN_LN_HRV_SPREAD);
    components.push(
      component(
        "hrv",
        hrv.overnight ? "HRV, overnight" : "HRV",
        (Math.log(hrv.today) - base.center) / base.spread,
        `${Math.round(hrv.today)} ms vs ${Math.round(Math.exp(base.center))} ms usual`,
      ),
    );
  }

  if (heartRate.today != null && heartRate.prior.length >= MIN_BASELINE_DAYS) {
    const base = robustBaseline(heartRate.prior, MIN_HR_SPREAD_BPM);
    components.push(
      component(
        "restingHeartRate",
        heartRate.overnight ? "Heart rate, overnight" : "Resting HR",
        -(heartRate.today - base.center) / base.spread,
        `${Math.round(heartRate.today)} bpm vs ${Math.round(base.center)} usual`,
      ),
    );
  }

  if (day.sleepDurationMinutes != null) {
    const slept = day.sleepDurationMinutes / 60;
    components.push(
      component(
        "sleep",
        "Sleep",
        Math.min(1, (slept - sleepTarget) / SLEEP_SPREAD_HOURS),
        `${hours(day.sleepDurationMinutes)} h of ${sleepTarget} h`,
      ),
    );
  }

  const weekStart = addDays(day.checkinDate, -6);
  const week = checkins.filter(
    (c) => c.checkinDate >= weekStart && c.checkinDate <= day.checkinDate,
  );
  const weekSleep = present(week.map((c) => c.sleepDurationMinutes));
  if (weekSleep.length >= 3) {
    const avg = weekSleep.reduce((s, v) => s + v, 0) / weekSleep.length;
    components.push(
      component(
        "sleepBalance",
        "Sleep, 7 nights",
        Math.min(1, (avg / 60 - sleepTarget) / SLEEP_BALANCE_SPREAD_HOURS),
        `${hours(avg)} h average`,
      ),
    );
  }

  const wakeTimes = present(week.map((c) => clockMinutes(c.wakeTimeLocal)));
  if (wakeTimes.length >= 4) {
    const mean = wakeTimes.reduce((s, v) => s + v, 0) / wakeTimes.length;
    const sd = Math.sqrt(
      wakeTimes.reduce((s, v) => s + (v - mean) ** 2, 0) / wakeTimes.length,
    );
    components.push(
      component(
        "wakeConsistency",
        "Wake time, 7 days",
        clamp((WAKE_SD_NEUTRAL_MIN - sd) / WAKE_SD_PER_Z_MIN, -2.5, 1),
        `±${Math.round(sd)} min`,
      ),
    );
  }

  const hasPhysiology = components.some(
    (c) => c.key === "hrv" || c.key === "restingHeartRate",
  );
  if (!hasPhysiology || components.length < 2) {
    const have = Math.max(hrv.prior.length, heartRate.prior.length);
    return {
      status: "insufficient",
      date: day.checkinDate,
      reason:
        have < MIN_BASELINE_DAYS
          ? `Building your baseline: ${have} of ${MIN_BASELINE_DAYS} days of HRV and resting HR.`
          : "Last night's HRV and resting HR have not synced yet.",
    };
  }

  const adjustments = buildAdjustments(day, prior, options.trainingLoad);

  const totalWeight = components.reduce((s, c) => s + WEIGHTS[c.key], 0);
  const z =
    components.reduce((s, c) => s + c.z * WEIGHTS[c.key], 0) / totalWeight;
  const penalty = adjustments.reduce((s, a) => s + a.points, 0);
  let score = clampScore(BASELINE_SCORE + SCORE_PER_Z * z - penalty);

  const baselineDays = hrv.prior.length;
  const calibrating = baselineDays < SETTLED_BASELINE_DAYS;
  const perfect =
    components.length === Object.keys(WEIGHTS).length &&
    components.every((c) => c.z >= 0) &&
    adjustments.length === 0 &&
    !calibrating;
  if (!perfect) score = Math.min(score, 99);
  if (calibrating) score = Math.min(score, CALIBRATING_MAX_SCORE);

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
    components: components.map(({ z: _z, ...rest }) => rest),
    adjustments,
    baselineDays,
    calibrating,
    caps,
  };
}

function buildAdjustments(
  day: RecoveryCheckin,
  prior: RecoveryCheckin[],
  trainingLoad: TrainingLoadDay[] | undefined,
): ReadinessAdjustment[] {
  const adjustments: ReadinessAdjustment[] = [];

  // Wrist temperature: a rise of 0.3 C or less is noise; above it, 4 points
  // per 0.1 C, capped at 25. A drop is not penalized.
  const priorTemp = present(prior.map((c) => c.sleepWristTempC));
  if (day.sleepWristTempC != null && priorTemp.length >= MIN_BASELINE_DAYS) {
    const deviation = day.sleepWristTempC - median(priorTemp);
    const points = Math.min(25, Math.round((deviation - 0.3) * 40));
    if (points > 0) {
      adjustments.push({
        key: "wristTemperature",
        label: "Wrist temperature",
        points,
        detail: `+${deviation.toFixed(1)} °C above usual`,
      });
    }
  }

  // Breathing rate is very steady night to night; past 1.5 robust SDs above
  // baseline, 8 points per SD, capped at 20.
  const priorResp = present(prior.map((c) => c.sleepRespiratoryRate));
  if (
    day.sleepRespiratoryRate != null &&
    priorResp.length >= MIN_BASELINE_DAYS
  ) {
    const base = robustBaseline(priorResp, MIN_RESPIRATORY_SPREAD);
    const z = (day.sleepRespiratoryRate - base.center) / base.spread;
    const points = Math.min(20, Math.round((z - 1.5) * 8));
    if (points > 0) {
      adjustments.push({
        key: "respiratoryRate",
        label: "Breathing rate",
        points,
        detail: `${day.sleepRespiratoryRate.toFixed(1)}/min vs ${base.center.toFixed(1)} usual`,
      });
    }
  }

  // Acute:chronic load. The last 7 days against the 4-week weekly average,
  // both ending the day before (today's session has not happened yet). Needs
  // three weeks of history; past 1.3x, 3 points per 0.1, capped at 15.
  if (trainingLoad && trainingLoad.length > 0) {
    const end = day.checkinDate;
    const sum = (from: string) =>
      trainingLoad
        .filter((d) => d.date >= from && d.date < end)
        .reduce((s, d) => s + d.load, 0);
    const acute = sum(addDays(end, -7));
    const chronicWeekly = sum(addDays(end, -28)) / 4;
    const hasHistory = trainingLoad[0]!.date <= addDays(end, -21);
    if (hasHistory && chronicWeekly > 0) {
      const ratio = acute / chronicWeekly;
      const points = Math.min(15, Math.round((ratio - 1.3) * 30));
      if (points > 0) {
        adjustments.push({
          key: "trainingLoad",
          label: "Training load",
          points,
          detail: `last 7 days ${ratio.toFixed(1)}x your 4-week average`,
        });
      }
    }
  }

  return adjustments;
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
