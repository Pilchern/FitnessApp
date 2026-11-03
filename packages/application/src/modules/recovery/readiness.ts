import type { KneeCheck, RecoveryCheckin } from "@fitness-app/domain";
import { kneeReadinessStatus } from "../program/knee-readiness";
import { strainFromTrimp } from "./strain-sleep";

/**
 * Daily readiness (v4): a 0-100 read on how ready you are today, built from
 * every signal the app has, each scored against your own baseline and shown
 * as its own contributor so the number can be checked.
 *
 * v3 scored only four signals and treated anything inside a normal band as
 * exactly normal, so most days printed 80. v4 scores every contributor on a
 * continuous curve (a normal reading is about 80, better earns a little, worse
 * costs more) and adds load, fuel, sleep quality and timing, vitals and the
 * check-in answers. Five groups:
 *
 * - Body: 7-night HRV trend (Plews 2013: the weekly mean tracks performance,
 *   one night barely does, so last night weighs half as much), overnight
 *   heart rate (on the Watch it agrees with ECG far better than HRV; Miller
 *   2022), and vitals (wrist temperature, breathing rate, SpO2; one-sided).
 * - Sleep: last night against tonight's need (target plus up to 45 min after
 *   a hard day), the 7-night average against target (debt costs more than
 *   one short night; Van Dongen 2003), quality (efficiency, deep + REM share,
 *   time awake vs your usual), and timing (bedtime vs your usual, wake-time
 *   spread).
 * - Training load: yesterday's strain against a typical training day, and the
 *   last 7 days against your 4-week weekly average. Weighted lightly: the
 *   acute:chronic ratio has no validated threshold (Impellizzeri 2020), but a
 *   big day or week is context the physiology may not show yet.
 * - Fuel: yesterday's calories and protein against target, and alcohol.
 * - You: soreness, stress, energy and the knee check when logged; how you feel
 *   (one tap) is blended in at 30% (Saw 2016: subjective measures track
 *   training stress at least as well as objective ones).
 *
 * Weights renormalize over what exists, so a missing signal never scores as
 * bad. Caps: vitals off together (Smarr 2020, Miller 2020), feeling rough,
 * soreness 8+, a knee-off check, or 3+ drinks.
 *
 * A heuristic, not a validated measure; no composite score is (Doherty 2025).
 */

export type ReadinessGroup = "body" | "sleep" | "load" | "fuel" | "you";

export type ReadinessComponentKey =
  | "hrvTrend"
  | "hrvLastNight"
  | "overnightHeartRate"
  | "vitals"
  | "sleep"
  | "sleepBalance"
  | "sleepQuality"
  | "sleepTiming"
  | "strainYesterday"
  | "loadBalance"
  | "fuel"
  | "soreness"
  | "stress"
  | "energy"
  | "knee"
  | "feel";

export type ReadinessLevel = "good" | "fair" | "low";

export type ReadinessComponent = {
  key: ReadinessComponentKey;
  group: ReadinessGroup;
  label: string;
  score: number;
  level: ReadinessLevel;
  detail: string;
  /** Share of today's score, 0-1, after renormalizing and the feel blend. */
  weight: number;
};

export type ReadinessGroupScore = {
  group: ReadinessGroup;
  label: string;
  score: number;
  level: ReadinessLevel;
  weight: number;
};

export type DailyReadiness =
  | {
      status: "scored";
      /** The check-in date scored: today, or yesterday when today has not synced. */
      date: string;
      score: number;
      level: ReadinessLevel;
      components: ReadinessComponent[];
      /** Weighted score per group, in display order. */
      groups: ReadinessGroupScore[];
      /** What pulled the score down most, worst first (up to 3). */
      limiters: string[];
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

export type ReadinessFuelDay = {
  date: string;
  calories: number | null;
  proteinGrams: number | null;
  alcoholCount: number;
};

export type ReadinessOptions = {
  /** Sleep need in hours asleep; last night and the 7-night average score against it. */
  sleepTargetHours?: number;
  /**
   * Training load (Banister TRIMP) by date. Pass it to score load; dates
   * missing from it count as rest days.
   */
  trimpByDate?: Record<string, number>;
  /** Dates with a lift, for the lift-day calorie target. */
  liftDates?: string[];
  nutrition?: ReadinessFuelDay[];
  fuelTargets?: {
    proteinGrams: number | null;
    caloriesLiftDay: number | null;
    caloriesRestDay: number | null;
  };
  /** Morning knee checks by date. */
  kneeChecks?: { date: string; check: KneeCheck }[];
};

/** Rolling baseline (Vesterinen 2016, Javaloyes 2019: 4 weeks). */
const BASELINE_WINDOW_DAYS = 30;
const MIN_BASELINE_DAYS = 5;
/** Baseline HRV nights before HRV counts at all: Apple's spot SDNN is noisy. */
const MIN_HRV_BASELINE_NIGHTS = 14;
/** Nights of the last 7 needed for the 7-night HRV value (Plews 2014: 3, plus one). */
const MIN_WEEK_NIGHTS = 4;
const DEFAULT_SLEEP_TARGET_HOURS = 7.5;

/** A normal reading; better earns up to the contributor's max, worse costs more. */
const NORMAL = 80;
const CREDIT_PER_SD = 8;
const COST_PER_SD = 15;
const FLOOR = 5;
const MAX_Z = 4;

const MIN_LN_HRV_SPREAD = 0.15;
const MIN_HR_SPREAD_BPM = 2.5;

/** Base weights; renormalized over the contributors present. */
const WEIGHTS: Record<Exclude<ReadinessComponentKey, "feel">, number> = {
  hrvTrend: 0.12,
  hrvLastNight: 0.06,
  overnightHeartRate: 0.14,
  vitals: 0.06,
  sleep: 0.12,
  sleepBalance: 0.1,
  sleepQuality: 0.05,
  sleepTiming: 0.04,
  strainYesterday: 0.08,
  loadBalance: 0.07,
  fuel: 0.06,
  soreness: 0.04,
  stress: 0.03,
  energy: 0.03,
  knee: 0.05,
};
/** Share of the score from how you feel, when logged. */
const FEEL_WEIGHT = 0.3;

const GROUP_LABEL: Record<ReadinessGroup, string> = {
  body: "Body",
  sleep: "Sleep",
  load: "Training load",
  fuel: "Fuel",
  you: "You",
};
const GROUP_ORDER: ReadinessGroup[] = ["body", "sleep", "load", "fuel", "you"];

/** Sleep need rises up to this much after a max-strain day. */
const STRAIN_SLEEP_MAX_HOURS = 0.75;
const STRAIN_MAX = 21;

/** Vitals: rises over the baseline median. */
const TEMP_SOFT_C = 0.5;
const TEMP_STRONG_C = 1.0;
const RESP_SOFT = 1.0;
const RESP_STRONG = 1.5;
const HR_SOFT_BPM = 5;
const VITALS_OFF_CAP = 59;
const POSSIBLE_ILLNESS_CAP = 45;
const LOW_CAP = 49;
const FAIR_CAP = 59;
const HEAVY_DRINKS = 3;

/**
 * Older rows average a fixed 23:00-05:59 window; fall asleep after 23:30 and
 * it holds awake time, so those rows' overnight values are skipped. Rows
 * averaged over the sleep window are always used.
 */
const LATEST_CLEAN_BEDTIME_MIN = 23 * 60 + 30;
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

function sd(values: number[]) {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** Median and a robust SD (1.4826 x MAD), floored. */
function robustBaseline(values: number[], minSpread: number) {
  const center = median(values);
  const mad = median(values.map((v) => Math.abs(v - center)));
  return { center, spread: Math.max(1.4826 * mad, minSpread) };
}

/** Score from a z where positive is better. */
function fromZ(z: number, max: number) {
  const zz = clamp(z, -MAX_Z, MAX_Z);
  const raw = NORMAL + (zz >= 0 ? CREDIT_PER_SD * zz : COST_PER_SD * zz);
  return clamp(raw, FLOOR, max);
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

/** Bedtime on a continuous evening scale: after midnight adds 24 h. */
function bedtimeMinutes(value: string | null): number | null {
  const m = clockMinutes(value);
  if (m == null) return null;
  return m < NOON_MIN ? m + 1440 : m;
}

function clockLabel(minutes: number) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, "0")} ${suffix}`;
}

function durationLabel(minutes: number) {
  const m = Math.round(Math.abs(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

function present(values: (number | null | undefined)[]): number[] {
  return values.filter(
    (v): v is number => v != null && Number.isFinite(v),
  ) as number[];
}

type Draft = {
  key: ReadinessComponentKey;
  group: ReadinessGroup;
  label: string;
  score: number;
  detail: string;
};

/**
 * An overnight reading, or null when the Watch recorded no sleep that night,
 * or when a fixed-window average met a bedtime after 23:30.
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

/** The day's own answers: how you feel, soreness, stress, energy, knee. */
type CheckinAnswers = {
  date: string;
  readinessLevel: number | null;
  sorenessLevel: number | null;
  stressLevel: number | null;
  energyLevel: number | null;
};

function answersFrom(date: string, row: RecoveryCheckin | undefined) {
  return {
    date,
    readinessLevel: row?.readinessLevel ?? null,
    sorenessLevel: row?.sorenessLevel ?? null,
    stressLevel: row?.stressLevel ?? null,
    energyLevel: row?.energyLevel ?? null,
  };
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

  // The check-in answers are today's only, even when the physiology falls
  // back to yesterday's row: yesterday's answers described yesterday.
  return scoreDay(checkins, day, options, answersFrom(today, todayRow));
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

function scoreDay(
  checkins: RecoveryCheckin[],
  day: RecoveryCheckin,
  options: ReadinessOptions,
  answers: CheckinAnswers,
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
  // Training and fuel that feed this morning are the day before the wake date.
  const dayBefore = addDays(day.checkinDate, -1);
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

  const drafts: Draft[] = [];
  const push = (d: Draft) => drafts.push(d);

  // ---- Body ----
  if (hrv.prior.length >= MIN_HRV_BASELINE_NIGHTS) {
    const base = robustBaseline(hrv.prior.map(Math.log), MIN_LN_HRV_SPREAD);
    const usual = Math.round(Math.exp(base.center));
    const weekHrv = present(week.map(hrv.read));
    if (weekHrv.length >= MIN_WEEK_NIGHTS) {
      // Median: with 4-5 spot readings a night, one odd night should not move the week.
      const weekLn = median(weekHrv.map(Math.log));
      push({
        key: "hrvTrend",
        group: "body",
        label: hrv.overnight ? "HRV, 7 nights" : "HRV, 7 days",
        // Credit above baseline is capped low: HRV also rises with overreaching (Bellenger 2016).
        score: fromZ((weekLn - base.center) / base.spread, 90),
        detail: `${Math.round(Math.exp(weekLn))} ms vs ${usual} ms usual`,
      });
    }
    if (hrv.today != null) {
      push({
        key: "hrvLastNight",
        group: "body",
        label: hrv.overnight ? "HRV, last night" : "HRV, today",
        score: fromZ((Math.log(hrv.today) - base.center) / base.spread, 90),
        detail: `${Math.round(hrv.today)} ms vs ${usual} ms usual`,
      });
    }
  }

  if (heartRate.today != null && heartRate.prior.length >= MIN_BASELINE_DAYS) {
    const base = robustBaseline(heartRate.prior, MIN_HR_SPREAD_BPM);
    push({
      key: "overnightHeartRate",
      group: "body",
      label: heartRate.overnight ? "Heart rate, overnight" : "Resting HR",
      score: fromZ(-(heartRate.today - base.center) / base.spread, 95),
      detail: `${Math.round(heartRate.today)} bpm vs ${Math.round(base.center)} usual`,
    });
  }

  const vitals = vitalsContributor(day, prior);
  if (vitals) push(vitals);

  // ---- Sleep ----
  const trimpByDate = options.trimpByDate;
  if (day.sleepDurationMinutes != null) {
    const strain = trimpByDate
      ? strainFromTrimp(trimpByDate[dayBefore] ?? 0)
      : 0;
    const need = sleepTarget + (strain / STRAIN_MAX) * STRAIN_SLEEP_MAX_HOURS;
    const slept = day.sleepDurationMinutes / 60;
    const short = need - slept;
    push({
      key: "sleep",
      group: "sleep",
      label: "Sleep, last night",
      score: clamp(
        short > 0 ? 85 - short * 30 : 85 + Math.min(15, -short * 20),
        FLOOR,
        100,
      ),
      detail: `${hours(day.sleepDurationMinutes)} h of ${Math.round(need * 10) / 10} h needed`,
    });
  }

  const weekSleep = present(week.map((c) => c.sleepDurationMinutes));
  if (weekSleep.length >= 3) {
    const avg = mean(weekSleep) / 60;
    const short = sleepTarget - avg;
    push({
      key: "sleepBalance",
      group: "sleep",
      label: "Sleep, 7 nights",
      score: clamp(
        short > 0 ? 85 - short * 40 : 85 + Math.min(10, -short * 20),
        FLOOR,
        100,
      ),
      detail: `${Math.round(avg * 10) / 10} h average vs ${sleepTarget} h`,
    });
  }

  const quality = sleepQualityContributor(day, prior);
  if (quality) push(quality);

  const timing = sleepTimingContributor(day, prior, week);
  if (timing) push(timing);

  // ---- Training load ----
  if (trimpByDate) {
    const load = loadContributors(trimpByDate, dayBefore);
    drafts.push(...load);
  }

  // ---- Fuel ----
  const fuel = fuelContributor(day, dayBefore, options);
  if (fuel) push(fuel);

  // ---- You ----
  if (answers.sorenessLevel != null) {
    const s = clamp(answers.sorenessLevel, 1, 10);
    push({
      key: "soreness",
      group: "you",
      label: "Soreness",
      score: 100 - (s - 1) * 10,
      detail: `${s}/10`,
    });
  }
  if (answers.stressLevel != null) {
    const s = clamp(answers.stressLevel, 1, 10);
    push({
      key: "stress",
      group: "you",
      label: "Stress",
      score: 100 - (s - 1) * 10,
      detail: `${s}/10`,
    });
  }
  if (answers.energyLevel != null) {
    const e = clamp(answers.energyLevel, 1, 10);
    push({
      key: "energy",
      group: "you",
      label: "Energy",
      score: e * 10,
      detail: `${e}/10`,
    });
  }
  const knee = options.kneeChecks?.find((k) => k.date === answers.date);
  const kneeStatus = knee ? kneeReadinessStatus(knee.check) : null;
  if (kneeStatus) {
    push({
      key: "knee",
      group: "you",
      label: "Knee check",
      score: kneeStatus === "normal" ? 90 : kneeStatus === "hold" ? 55 : 25,
      detail:
        kneeStatus === "normal"
          ? "normal"
          : kneeStatus === "hold"
            ? "hold loads"
            : "knee off",
    });
  }

  const hasPhysiology = drafts.some(
    (c) =>
      c.key === "hrvTrend" ||
      c.key === "hrvLastNight" ||
      c.key === "overnightHeartRate",
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

  const totalWeight = drafts.reduce(
    (s, c) => s + WEIGHTS[c.key as keyof typeof WEIGHTS],
    0,
  );
  let score =
    drafts.reduce(
      (s, c) => s + c.score * WEIGHTS[c.key as keyof typeof WEIGHTS],
      0,
    ) / totalWeight;

  const feelRating =
    answers.readinessLevel != null
      ? clamp(answers.readinessLevel, 1, 10)
      : null;
  const feelShare = feelRating != null ? FEEL_WEIGHT : 0;
  if (feelRating != null) {
    score = (1 - FEEL_WEIGHT) * score + FEEL_WEIGHT * feelRating * 10;
  }
  score = clampScore(score);

  const components: ReadinessComponent[] = drafts.map((d) => {
    const s = Math.round(d.score);
    return {
      ...d,
      score: s,
      level: readinessLevel(s),
      weight:
        (WEIGHTS[d.key as keyof typeof WEIGHTS] / totalWeight) *
        (1 - feelShare),
    };
  });
  if (feelRating != null) {
    components.push({
      key: "feel",
      group: "you",
      label: "How you feel",
      score: feelRating * 10,
      level: readinessLevel(feelRating * 10),
      detail: `${feelRating}/10`,
      weight: FEEL_WEIGHT,
    });
  }

  // ---- Caps ----
  const caps: string[] = [];
  const vitalsCap = vitalsCheck(day, prior, heartRate);
  if (vitalsCap) {
    caps.push(vitalsCap.reason);
    score = Math.min(score, vitalsCap.cap);
  }
  if (answers.sorenessLevel != null && answers.sorenessLevel >= 8) {
    caps.push(`Soreness logged at ${answers.sorenessLevel}/10`);
    score = Math.min(score, LOW_CAP);
  }
  if (feelRating != null && feelRating <= 3) {
    caps.push(`You rated how you feel ${feelRating}/10`);
    score = Math.min(score, LOW_CAP);
  }
  if (kneeStatus === "knee_off") {
    caps.push("Knee check says knee off: leg block replaced today");
    score = Math.min(score, FAIR_CAP);
  }
  const drinks = drinksBefore(day, dayBefore, options);
  if (drinks >= HEAVY_DRINKS) {
    caps.push(`${drinks} drinks logged last night`);
    score = Math.min(score, FAIR_CAP);
  }

  const groups: ReadinessGroupScore[] = GROUP_ORDER.flatMap((group) => {
    const members = components.filter((c) => c.group === group);
    const weight = members.reduce((s, c) => s + c.weight, 0);
    if (members.length === 0 || weight <= 0) return [];
    const groupScore = Math.round(
      members.reduce((s, c) => s + c.score * c.weight, 0) / weight,
    );
    return [
      {
        group,
        label: GROUP_LABEL[group],
        score: groupScore,
        level: readinessLevel(groupScore),
        weight,
      },
    ];
  });

  // Points each contributor costs against a normal reading, biggest first.
  const limiters = components
    .filter((c) => c.score < 70)
    .map((c) => ({ c, cost: (NORMAL - c.score) * c.weight }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3)
    .map(({ c }) => `${c.label} (${c.detail})`);

  const baselineDays = hrv.prior.length;
  return {
    status: "scored",
    date: day.checkinDate,
    score,
    level: readinessLevel(score),
    components,
    groups,
    limiters,
    baselineDays,
    calibrating: baselineDays < MIN_HRV_BASELINE_NIGHTS,
    caps,
  };
}

/**
 * Wrist temperature, breathing rate and SpO2 against their 30-day medians,
 * one-sided (a cooler night is not extra recovery). Normal is 85.
 */
function vitalsContributor(
  day: RecoveryCheckin,
  prior: RecoveryCheckin[],
): Draft | null {
  const parts: string[] = [];
  let cost = 0;
  let seen = 0;

  const priorTemp = present(prior.map((c) => c.sleepWristTempC));
  if (day.sleepWristTempC != null && priorTemp.length >= MIN_BASELINE_DAYS) {
    seen += 1;
    const rise = day.sleepWristTempC - median(priorTemp);
    cost += Math.max(0, rise - 0.2) * 60;
    parts.push(`temp ${signed(rise, 1)} °C`);
  }
  const priorResp = present(
    prior.map((c) => overnightReading(c, c.sleepRespiratoryRate)),
  );
  const resp = overnightReading(day, day.sleepRespiratoryRate);
  if (resp != null && priorResp.length >= MIN_BASELINE_DAYS) {
    seen += 1;
    const rise = resp - median(priorResp);
    cost += Math.max(0, rise - 0.5) * 30;
    parts.push(`breathing ${signed(rise, 1)}/min`);
  }
  const priorSpo2 = present(prior.map((c) => c.sleepSpo2AvgPct));
  if (day.sleepSpo2AvgPct != null && priorSpo2.length >= MIN_BASELINE_DAYS) {
    seen += 1;
    const drop = median(priorSpo2) - day.sleepSpo2AvgPct;
    cost += Math.max(0, drop - 1) * 15;
    parts.push(`SpO2 ${signed(-drop, 1)}%`);
  }
  if (seen === 0) return null;
  return {
    key: "vitals",
    group: "body",
    label: "Vitals",
    score: clamp(85 - cost, FLOOR, 85),
    detail: parts.join(", "),
  };
}

/** Efficiency, deep + REM share and time awake against your usual. */
function sleepQualityContributor(
  day: RecoveryCheckin,
  prior: RecoveryCheckin[],
): Draft | null {
  const asleep = day.sleepDurationMinutes;
  if (asleep == null || asleep <= 0) return null;

  const efficiency = (c: RecoveryCheckin) =>
    c.sleepDurationMinutes != null &&
    c.timeInBedMinutes != null &&
    c.timeInBedMinutes > 0
      ? Math.min(1, c.sleepDurationMinutes / c.timeInBedMinutes)
      : null;
  const restorative = (c: RecoveryCheckin) =>
    c.sleepDurationMinutes != null &&
    c.sleepDurationMinutes > 0 &&
    c.deepSleepMinutes != null &&
    c.remSleepMinutes != null
      ? (c.deepSleepMinutes + c.remSleepMinutes) / c.sleepDurationMinutes
      : null;
  const awake = (c: RecoveryCheckin) => c.awakeMinutes;

  const zs: number[] = [];
  const parts: string[] = [];
  const score = (
    read: (c: RecoveryCheckin) => number | null,
    minSpread: number,
    higherIsBetter: boolean,
    describe: (v: number) => string,
  ) => {
    const today = read(day);
    const base = present(prior.map(read));
    if (today == null || base.length < 7) return;
    const b = robustBaseline(base, minSpread);
    const z = (today - b.center) / b.spread;
    zs.push(higherIsBetter ? z : -z);
    parts.push(describe(today));
  };
  score(efficiency, 0.02, true, (v) => `${Math.round(v * 100)}% efficient`);
  score(restorative, 0.03, true, (v) => `${hours(v * asleep)} h deep + REM`);
  score(awake, 8, false, (v) => `${Math.round(v)} min awake`);
  if (zs.length === 0) return null;
  return {
    key: "sleepQuality",
    group: "sleep",
    label: "Sleep quality",
    score: fromZ(mean(zs), 95),
    detail: parts.join(", "),
  };
}

/** Bedtime against your usual, and how much wake time moved this week. */
function sleepTimingContributor(
  day: RecoveryCheckin,
  prior: RecoveryCheckin[],
  week: RecoveryCheckin[],
): Draft | null {
  const bed = bedtimeMinutes(day.bedtimeLocal);
  const priorBeds = present(prior.map((c) => bedtimeMinutes(c.bedtimeLocal)));
  if (bed == null || priorBeds.length < 7) return null;
  const usual = median(priorBeds);
  const late = bed - usual;
  let score = 85 - (Math.max(0, late - 20) / 60) * 25;
  const parts = [
    `bed ${clockLabel(bed)}` +
      (Math.abs(late) >= 15
        ? `, ${durationLabel(late)} ${late > 0 ? "later" : "earlier"} than usual`
        : ", usual time"),
  ];

  const wakes = present(week.map((c) => clockMinutes(c.wakeTimeLocal)));
  if (wakes.length >= 4) {
    const spread = sd(wakes);
    score -= (Math.max(0, spread - 30) / 30) * 10;
    if (spread > 30) parts.push(`wake time varies ${Math.round(spread)} min`);
  }
  return {
    key: "sleepTiming",
    group: "sleep",
    label: "Sleep timing",
    score: clamp(score, FLOOR, 90),
    detail: parts.join("; "),
  };
}

/**
 * Yesterday's strain against a typical training day, and the last 7 days
 * against the 4-week weekly average. Dates missing from the map are rest.
 */
function loadContributors(
  trimpByDate: Record<string, number>,
  dayBefore: string,
): Draft[] {
  const out: Draft[] = [];
  const last28 = Array.from(
    { length: 28 },
    (_, i) => trimpByDate[addDays(dayBefore, -i)] ?? 0,
  );
  const trainingDays = last28.slice(1).filter((t) => t > 0);
  const yesterday = last28[0]!;

  if (trainingDays.length >= 5) {
    const typical = median(trainingDays);
    const ratio = typical > 0 ? yesterday / typical : 0;
    const strain = strainFromTrimp(yesterday);
    out.push({
      key: "strainYesterday",
      group: "load",
      label: "Strain, yesterday",
      score: clamp(90 - 8 * ratio - Math.max(0, ratio - 1) * 16, FLOOR, 90),
      detail:
        yesterday > 0
          ? `${strain} vs ${strainFromTrimp(typical)} on a usual training day`
          : "rest day",
    });
  }

  const chronicWeekly = last28.reduce((s, t) => s + t, 0) / 4;
  if (chronicWeekly > 0 && trainingDays.length >= 5) {
    const acute = last28.slice(0, 7).reduce((s, t) => s + t, 0);
    const ratio = acute / chronicWeekly;
    out.push({
      key: "loadBalance",
      group: "load",
      label: "Load, 7 days",
      // Gentle slope: a planned ramp should cost a few points, not the day.
      score: clamp(
        ratio <= 0.8 ? 88 : 85 - Math.max(0, ratio - 1.1) * 40,
        30,
        88,
      ),
      detail: `${ratio.toFixed(2)}x your 4-week weekly average`,
    });
  }
  return out;
}

function drinksBefore(
  day: RecoveryCheckin,
  dayBefore: string,
  options: ReadinessOptions,
) {
  const logged =
    options.nutrition?.find((n) => n.date === dayBefore)?.alcoholCount ?? 0;
  return Math.max(logged, day.alcoholCount ?? 0);
}

/** Yesterday's calories and protein against target, less alcohol. */
function fuelContributor(
  day: RecoveryCheckin,
  dayBefore: string,
  options: ReadinessOptions,
): Draft | null {
  const log = options.nutrition?.find((n) => n.date === dayBefore);
  const drinks = drinksBefore(day, dayBefore, options);
  const targets = options.fuelTargets;
  const parts: string[] = [];
  const scores: number[] = [];

  const liftDay = options.liftDates?.includes(dayBefore) ?? false;
  const calorieTarget = liftDay
    ? (targets?.caloriesLiftDay ?? targets?.caloriesRestDay ?? null)
    : (targets?.caloriesRestDay ?? targets?.caloriesLiftDay ?? null);
  if (log?.calories != null && log.calories > 0 && calorieTarget) {
    const pct = ((log.calories - calorieTarget) / calorieTarget) * 100;
    // Under-fuelling hurts recovery more than a modest surplus.
    const cost =
      pct < -10 ? (-pct - 10) * 1.5 : pct > 15 ? (pct - 15) * 0.5 : 0;
    scores.push(clamp(85 - cost, FLOOR, 85));
    parts.push(
      `${Math.round(log.calories).toLocaleString("en-US")} kcal of ${calorieTarget.toLocaleString("en-US")}`,
    );
  }
  if (log?.proteinGrams != null && targets?.proteinGrams) {
    const shortPct = Math.max(
      0,
      ((targets.proteinGrams - log.proteinGrams) / targets.proteinGrams) * 100,
    );
    scores.push(clamp(90 - shortPct * 1.5, FLOOR, 90));
    parts.push(
      `${Math.round(log.proteinGrams)} g protein of ${targets.proteinGrams}`,
    );
  }
  if (scores.length === 0 && drinks === 0) return null;
  const base = scores.length > 0 ? mean(scores) : 85;
  if (drinks > 0) parts.push(`${drinks} drink${drinks === 1 ? "" : "s"}`);
  return {
    key: "fuel",
    group: "fuel",
    label: "Fuel, yesterday",
    score: clamp(base - drinks * 15, FLOOR, 90),
    detail: parts.join(", "),
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
    const result = scoreDay(checkins, row, options, answersFrom(date, row));
    return { date, score: result.status === "scored" ? result.score : null };
  });
}
