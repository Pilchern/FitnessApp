import type { RecoveryCheckin } from "@fitness-app/domain";

/**
 * Daily readiness (v3): a 0-100 estimate of how recovered you are today,
 * against your own baseline. It exists to make one call: progress, hold, or
 * go light. Built from what the evidence supports, for sparse Apple Watch data:
 *
 * 1. HRV as a 7-night trend, not one night. The Watch stores a handful of
 *    spot SDNN readings a night (4-5, ranging 23-99 ms within a night), so a
 *    single night is mostly noise (Plews 2013: one day r = -0.06 with
 *    performance, the weekly mean r = 0.72). The 7-night median of ln HRV is
 *    compared with a 30-day baseline, and inside +/- 0.5 SD counts as normal:
 *    the HRV-guided training rule (Vesterinen 2016, Javaloyes 2019). Above
 *    normal earns nothing: HRV can rise with overreaching (Bellenger 2016).
 * 2. Overnight heart rate against baseline, normal within about 3 bpm
 *    (illness and drinks move it 3-4+ bpm; hard training about 1%).
 * 3. Sleep: the 7-night average carries more than last night, since
 *    accumulated debt costs more than one short night (Van Dongen 2003;
 *    Craven 2022: one night costs maximal strength little). No credit above
 *    the target.
 * 4. Each signal is scored past a dead band, so a normal day is about 80
 *    and one late night lands in fair, not low.
 * 5. Vitals checked together, Apple Vitals style: wrist temperature,
 *    breathing rate and overnight HR. One elevated signal alone is common
 *    (warm room, late meal) and only counts through HR; two at once cap the
 *    score at fair; a strong temperature or breathing rise with anything
 *    else caps it in low as possible illness (Smarr 2020, Miller 2020,
 *    Mason 2022). One event is not triple-counted as stacked penalties.
 * 6. How you feel, when logged, is 35% of the score: subjective measures
 *    track training stress at least as well as objective ones (Saw 2016).
 *    Rough (3 or less) or soreness 8+ caps at low.
 *
 * Not used, on purpose: training load (the acute:chronic ratio has no
 * validated threshold, Impellizzeri 2020/2021, and the only trial found no
 * benefit, Dalen-Lorentsen 2021; physiology already reflects load), and
 * wake-time consistency (a long-run health habit, not next-day readiness).
 *
 * A heuristic, not a validated measure; no composite score is (Doherty 2025).
 * Every contributor is reported so the number can be checked.
 */

export type ReadinessComponentKey =
  | "hrvTrend"
  | "overnightHeartRate"
  | "sleep"
  | "sleepBalance"
  | "feel";

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
      /** Nights of HRV in the baseline window; under 14 HRV is not scored yet. */
      baselineDays: number;
      calibrating: boolean;
      /** Why the score was capped (vitals off, feeling rough, soreness); empty when not. */
      caps: string[];
    }
  | {
      status: "insufficient";
      date: string | null;
      reason: string;
    };

export type ReadinessOptions = {
  /** Sleep need in hours asleep; last night and the 7-night average score against it. */
  sleepTargetHours?: number;
};

/** Rolling baseline (Vesterinen 2016, Javaloyes 2019: 4 weeks; Mishra 2020: 28 days). */
const BASELINE_WINDOW_DAYS = 30;
const MIN_BASELINE_DAYS = 5;
/** Baseline HRV nights before HRV counts at all: Apple's spot SDNN is noisy. */
const MIN_HRV_BASELINE_NIGHTS = 14;
/**
 * Nights of the last 7 needed for the 7-night HRV value. Plews 2014: 3 is the
 * floor for chest-strap RMSSD; one more for the Watch's noisier readings.
 */
const MIN_WEEK_NIGHTS = 4;
const DEFAULT_SLEEP_TARGET_HOURS = 7.5;

/** A day with every signal normal; each unit of weighted deviation moves it this much. */
const NORMAL_SCORE = 80;
const SCORE_PER_UNIT = 20;
/** Most a contributor can pull down, in units, and the most credit it can add. */
const MAX_DEFICIT = 3;
const MAX_CREDIT = 0.5;

/** HRV: inside +/- 0.5 SD of baseline is normal (smallest worthwhile change). */
const HRV_DEAD_BAND_SD = 0.5;
const MIN_LN_HRV_SPREAD = 0.15;
/** Overnight HR: spread floor 3 bpm, normal within 1 spread (about 3 bpm). */
const MIN_HR_SPREAD_BPM = 3;
const HR_DEAD_BAND_SD = 1;
/**
 * Sleep, hours under target before it costs, and hours per unit after that.
 * Last night: 45 min short is free, then 1 unit per 45 min (6 h of 7.5 =
 * -1). 7-night average: 15 min short is free, then 1 unit per 15 min
 * (7 h average = -1, 6.5 h = -3, the floor): debt is what costs.
 */
const SLEEP_GRACE_HOURS = 0.75;
const SLEEP_HOURS_PER_UNIT = 0.75;
const SLEEP_BALANCE_GRACE_HOURS = 0.25;
const SLEEP_BALANCE_HOURS_PER_UNIT = 0.25;

/**
 * Overnight HR weighs as much as HRV: on the Watch it agrees with ECG
 * (ICC 0.96) far better than HRV does (0.67; Miller 2022), and it is the
 * more specific signal for illness and drinks (Altini & Plews 2021).
 */
const WEIGHTS: Record<Exclude<ReadinessComponentKey, "feel">, number> = {
  hrvTrend: 0.3,
  overnightHeartRate: 0.3,
  sleep: 0.15,
  sleepBalance: 0.25,
};
/** Share of the score from how you feel, when logged. */
const FEEL_WEIGHT = 0.35;

/** Vitals: soft and strong rises over the baseline median. */
const TEMP_SOFT_C = 0.5;
const TEMP_STRONG_C = 1.0;
const RESP_SOFT = 1.0;
const RESP_STRONG = 1.5;
const HR_SOFT_BPM = 5;
const VITALS_OFF_CAP = 59;
const POSSIBLE_ILLNESS_CAP = 45;
const LOW_CAP = 49;

/**
 * Older rows (and nights before sleep synced) average a fixed 23:00-05:59
 * window. Fall asleep after 23:30 and that window holds awake time, which
 * reads as a high heart rate and low HRV, so on those rows the night's
 * overnight HR, HRV and breathing rate are not used (today or in the
 * baseline). Rows averaged over the sleep window are always used.
 */
const LATEST_CLEAN_BEDTIME_MIN = 23 * 60 + 30;
/** Bedtimes before noon are after midnight. */
const NOON_MIN = 12 * 60;

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

function mean(values: number[]) {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Median and a robust SD (1.4826 x MAD), floored. */
function robustBaseline(values: number[], minSpread: number) {
  const center = median(values);
  const mad = median(values.map((v) => Math.abs(v - center)));
  return { center, spread: Math.max(1.4826 * mad, minSpread) };
}

/** z past a dead band: 0 inside +/- band, then the distance beyond it. */
function beyondBand(z: number, band: number) {
  if (Math.abs(z) <= band) return 0;
  return z > 0 ? z - band : z + band;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function hours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function signed(value: number, digits = 0) {
  const text = value.toFixed(digits);
  return value > 0 ? `+${text}` : text;
}

/** "06:42" -> 402. */
function clockMinutes(value: string | null): number | null {
  const match = value ? /^(\d{1,2}):(\d{2})/.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function present(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v));
}

type Scored = ReadinessComponent & { units: number };

function component(
  key: ReadinessComponentKey,
  label: string,
  units: number,
  detail: string,
): Scored {
  units = clamp(units, -MAX_DEFICIT, MAX_CREDIT);
  const score = clampScore(NORMAL_SCORE + SCORE_PER_UNIT * units);
  return { key, label, score, level: readinessLevel(score), detail, units };
}

/** Hours short of target past the grace, in units (never positive). */
function sleepUnits(
  sleptHours: number,
  targetHours: number,
  graceHours: number,
  hoursPerUnit: number,
) {
  const short = targetHours - graceHours - sleptHours;
  return short > 0 ? -short / hoursPerUnit : 0;
}

/**
 * An overnight reading, or null when the Watch recorded no sleep that night
 * (the window is awake or off-wrist), or when a fixed-window average met a
 * bedtime after 23:30.
 */
function overnightReading(checkin: RecoveryCheckin, value: number | null) {
  if (checkin.sleepDurationMinutes == null) return null;
  const bedtime = clockMinutes(checkin.bedtimeLocal);
  if (
    checkin.overnightWindow !== "sleep" &&
    bedtime != null &&
    (bedtime > LATEST_CLEAN_BEDTIME_MIN || bedtime < NOON_MIN)
  ) {
    return null;
  }
  return value != null && value > 0 ? value : null;
}

function hasSignal(checkin: RecoveryCheckin) {
  return (
    checkin.hrv != null ||
    checkin.sleepHrvAvg != null ||
    checkin.sleepDurationMinutes != null
  );
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

  // How you feel is today's rating only, even when the physiology falls back
  // to yesterday's row: yesterday's rating described yesterday.
  return scoreDay(checkins, day, options, {
    readinessLevel: todayRow?.readinessLevel ?? null,
    sorenessLevel: todayRow?.sorenessLevel ?? null,
  });
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
    return { today, prior: overnightPrior, overnight: true, read: overnight };
  }
  return {
    today: daily(day),
    prior: present(prior.map(daily)),
    overnight: false,
    read: daily,
  };
}

type Feel = {
  readinessLevel: number | null;
  sorenessLevel: number | null;
};

function scoreDay(
  checkins: RecoveryCheckin[],
  day: RecoveryCheckin,
  options: ReadinessOptions,
  feel: Feel,
): DailyReadiness {
  const sleepTarget = options.sleepTargetHours ?? DEFAULT_SLEEP_TARGET_HOURS;
  const windowStart = addDays(day.checkinDate, -BASELINE_WINDOW_DAYS);
  const prior = checkins.filter(
    (c) => c.checkinDate < day.checkinDate && c.checkinDate >= windowStart,
  );
  const weekStart = addDays(day.checkinDate, -6);
  const week = checkins.filter(
    (c) => c.checkinDate >= weekStart && c.checkinDate <= day.checkinDate,
  );
  const positive = (v: number | null) => (v != null && v > 0 ? v : null);

  const hrv = pickSeries(
    day,
    prior,
    (c) => overnightReading(c, c.sleepHrvAvg),
    (c) => positive(c.hrv),
  );
  const heartRate = pickSeries(
    day,
    prior,
    (c) => overnightReading(c, c.sleepAvgHeartRate),
    (c) => c.restingHeartRate,
  );

  const components: Scored[] = [];

  // HRV: the 7-night median of ln HRV against the baseline's daily spread
  // (the normal range is built from single nights, HRV4Training style).
  const weekHrv = present(week.map(hrv.read));
  if (
    hrv.prior.length >= MIN_HRV_BASELINE_NIGHTS &&
    weekHrv.length >= MIN_WEEK_NIGHTS
  ) {
    const base = robustBaseline(hrv.prior.map(Math.log), MIN_LN_HRV_SPREAD);
    // Median, not mean: with 4-5 spot readings a night, odd nights are
    // common, and one should not move the week.
    const weekLn = median(weekHrv.map(Math.log));
    const usual = Math.round(Math.exp(base.center));
    const last =
      hrv.today != null ? `; last night ${Math.round(hrv.today)} ms` : "";
    components.push(
      component(
        "hrvTrend",
        hrv.overnight ? "HRV, 7 nights" : "HRV, 7 days",
        Math.min(
          0,
          beyondBand((weekLn - base.center) / base.spread, HRV_DEAD_BAND_SD),
        ),
        `${Math.round(Math.exp(weekLn))} ms vs ${usual} ms usual${last}`,
      ),
    );
  }

  if (heartRate.today != null && heartRate.prior.length >= MIN_BASELINE_DAYS) {
    const base = robustBaseline(heartRate.prior, MIN_HR_SPREAD_BPM);
    components.push(
      component(
        "overnightHeartRate",
        heartRate.overnight ? "Heart rate, overnight" : "Resting HR",
        beyondBand(
          -(heartRate.today - base.center) / base.spread,
          HR_DEAD_BAND_SD,
        ),
        `${Math.round(heartRate.today)} bpm vs ${Math.round(base.center)} usual`,
      ),
    );
  }

  if (day.sleepDurationMinutes != null) {
    components.push(
      component(
        "sleep",
        "Sleep, last night",
        sleepUnits(
          day.sleepDurationMinutes / 60,
          sleepTarget,
          SLEEP_GRACE_HOURS,
          SLEEP_HOURS_PER_UNIT,
        ),
        `${hours(day.sleepDurationMinutes)} h of ${sleepTarget} h`,
      ),
    );
  }

  const weekSleep = present(week.map((c) => c.sleepDurationMinutes));
  if (weekSleep.length >= 3) {
    const avg = mean(weekSleep);
    components.push(
      component(
        "sleepBalance",
        "Sleep, 7 nights",
        sleepUnits(
          avg / 60,
          sleepTarget,
          SLEEP_BALANCE_GRACE_HOURS,
          SLEEP_BALANCE_HOURS_PER_UNIT,
        ),
        `${hours(avg)} h average`,
      ),
    );
  }

  const hasPhysiology = components.some(
    (c) => c.key === "hrvTrend" || c.key === "overnightHeartRate",
  );
  if (!hasPhysiology) {
    const have = Math.max(hrv.prior.length, heartRate.prior.length);
    return {
      status: "insufficient",
      date: day.checkinDate,
      reason:
        have < MIN_BASELINE_DAYS
          ? `Building your baseline: ${have} of ${MIN_BASELINE_DAYS} nights of HRV and heart rate.`
          : "Last night's HRV and heart rate have not synced yet.",
    };
  }

  const totalWeight = components.reduce(
    (s, c) => s + WEIGHTS[c.key as keyof typeof WEIGHTS],
    0,
  );
  const units =
    components.reduce(
      (s, c) => s + c.units * WEIGHTS[c.key as keyof typeof WEIGHTS],
      0,
    ) / totalWeight;
  let score = NORMAL_SCORE + SCORE_PER_UNIT * units;

  if (feel.readinessLevel != null) {
    const rating = clamp(feel.readinessLevel, 1, 10);
    const feelScore = rating * 10;
    components.push({
      key: "feel",
      label: "How you feel",
      score: feelScore,
      level: readinessLevel(feelScore),
      detail: `${rating}/10`,
      units: 0,
    });
    score = (1 - FEEL_WEIGHT) * score + FEEL_WEIGHT * feelScore;
  }
  score = clampScore(score);

  const caps: string[] = [];
  const vitals = vitalsCheck(day, prior, heartRate);
  if (vitals) {
    caps.push(vitals.reason);
    score = Math.min(score, vitals.cap);
  }
  if (feel.sorenessLevel != null && feel.sorenessLevel >= 8) {
    caps.push(`Soreness logged at ${feel.sorenessLevel}/10`);
    score = Math.min(score, LOW_CAP);
  }
  if (feel.readinessLevel != null && feel.readinessLevel <= 3) {
    caps.push(`You rated how you feel ${feel.readinessLevel}/10`);
    score = Math.min(score, LOW_CAP);
  }

  const baselineDays = hrv.prior.length;
  return {
    status: "scored",
    date: day.checkinDate,
    score,
    level: readinessLevel(score),
    components: components.map(({ units: _units, ...rest }) => rest),
    baselineDays,
    calibrating: baselineDays < MIN_HRV_BASELINE_NIGHTS,
    caps,
  };
}

/**
 * Wrist temperature, breathing rate and overnight HR against their baseline
 * medians, checked together. Two elevated at once caps at fair; a strong
 * temperature or breathing rise plus any other caps at low.
 */
function vitalsCheck(
  day: RecoveryCheckin,
  prior: RecoveryCheckin[],
  heartRate: { today: number | null; prior: number[] },
): { cap: number; reason: string } | null {
  const flags: { label: string; strong: boolean }[] = [];

  const priorTemp = present(prior.map((c) => c.sleepWristTempC));
  if (day.sleepWristTempC != null && priorTemp.length >= MIN_BASELINE_DAYS) {
    const rise = day.sleepWristTempC - median(priorTemp);
    if (rise >= TEMP_SOFT_C) {
      flags.push({
        label: `wrist temperature ${signed(rise, 1)} °C`,
        strong: rise >= TEMP_STRONG_C,
      });
    }
  }

  const priorResp = present(
    prior.map((c) => overnightReading(c, c.sleepRespiratoryRate)),
  );
  const resp = overnightReading(day, day.sleepRespiratoryRate);
  if (resp != null && priorResp.length >= MIN_BASELINE_DAYS) {
    const rise = resp - median(priorResp);
    if (rise >= RESP_SOFT) {
      flags.push({
        label: `breathing rate ${signed(rise, 1)}/min`,
        strong: rise >= RESP_STRONG,
      });
    }
  }

  if (heartRate.today != null && heartRate.prior.length >= MIN_BASELINE_DAYS) {
    const rise = heartRate.today - median(heartRate.prior);
    if (rise >= HR_SOFT_BPM) {
      flags.push({
        label: `overnight heart rate ${signed(Math.round(rise))} bpm`,
        strong: false,
      });
    }
  }

  const strong = flags.some((f) => f.strong);
  const list = flags.map((f) => f.label).join(", ");
  if (flags.length >= 3 || (strong && flags.length >= 2)) {
    return {
      cap: POSSIBLE_ILLNESS_CAP,
      reason: `Possible illness: ${list} above usual`,
    };
  }
  if (flags.length >= 2 || strong) {
    return {
      cap: VITALS_OFF_CAP,
      reason: `Vitals off: ${list} above usual (a late night, late meal or drinks, or getting sick)`,
    };
  }
  return null;
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
    const result = scoreDay(checkins, row, options, {
      readinessLevel: row.readinessLevel,
      sorenessLevel: row.sorenessLevel,
    });
    return { date, score: result.status === "scored" ? result.score : null };
  });
}
