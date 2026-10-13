import type {
  CardioSession,
  RecoveryCheckin,
  StrengthSession,
} from "@fitness-app/domain";

/**
 * The other two Whoop-style pillars next to readiness: how hard the day was
 * (strain) and how much sleep that, plus recent debt, calls for.
 *
 * Strain: Banister TRIMP per session from average heart rate and duration
 * (minutes x HR reserve fraction x 0.64 e^(1.92 x fraction) for men, 0.86 and
 * 1.67 for women), summed per day and put on a 0-21 log-shaped scale. Whoop's
 * own formula is proprietary, so this scale is the app's own: compare days
 * with each other, not with a Whoop number. Max HR is Tanaka (208 - 0.7 x
 * age); resting HR is the caller's recent median.
 *
 * Sleep need: the sleep target, plus up to 45 min after a hard day, plus half
 * of the last three nights' shortfall (capped at an hour). Heuristic weights,
 * to be recalibrated against real data.
 */

export type HeartRateSex = "male" | "female";

const STRAIN_MAX = 21;
/** TRIMP at which strain reaches about 63% of the max (21 x (1 - 1/e)). */
const STRAIN_TRIMP_SCALE = 150;
const STRAIN_SLEEP_MAX_HOURS = 0.75;
const DEBT_NIGHTS = 3;
const DEBT_REPAY_SHARE = 0.5;
const DEBT_REPAY_MAX_HOURS = 1;
const DEFAULT_SLEEP_EFFICIENCY = 0.92;

export function estimatedMaxHeartRate(age: number): number {
  return Math.round(208 - 0.7 * age);
}

/**
 * Zone 2 as the plan defines it: about 65-75% of max HR, the same band
 * Peloton uses. 60-70% credited 16 of a 30 min ride Peloton scored as all
 * Zone 2 (owner call, 2026-10-13). Both are age estimates; swap in a measured
 * band once there is a bike test.
 */
export function zone2HeartRateRange(age: number): [number, number] {
  const max = estimatedMaxHeartRate(age);
  return [Math.round(max * 0.65), Math.round(max * 0.75)];
}

export function banisterTrimp(input: {
  minutes: number;
  avgHeartRate: number;
  restingHeartRate: number;
  maxHeartRate: number;
  sex: HeartRateSex;
}): number {
  const reserve = input.maxHeartRate - input.restingHeartRate;
  if (reserve <= 0 || input.minutes <= 0) return 0;
  const fraction = Math.min(
    1,
    Math.max(0, (input.avgHeartRate - input.restingHeartRate) / reserve),
  );
  const [a, b] = input.sex === "female" ? [0.86, 1.67] : [0.64, 1.92];
  return input.minutes * fraction * a * Math.exp(b * fraction);
}

export function strainFromTrimp(trimp: number): number {
  const strain = STRAIN_MAX * (1 - Math.exp(-trimp / STRAIN_TRIMP_SCALE));
  return Math.round(strain * 10) / 10;
}

export type StrainSession = {
  label: string;
  minutes: number;
  avgHeartRate: number;
  trimp: number;
};

export type DailyStrain = {
  date: string;
  strain: number;
  trimp: number;
  sessions: StrainSession[];
  /** Sessions that day with no heart rate, so not counted. */
  unscored: number;
};

export type StrainContext = {
  restingHeartRate: number;
  maxHeartRate: number;
  sex: HeartRateSex;
};

/** Strain for each date, from completed cardio and logged lifts. */
export function buildDailyStrain(
  dates: string[],
  cardio: Pick<
    CardioSession,
    | "sessionDate"
    | "durationMinutes"
    | "avgHeartRate"
    | "plannedVsCompleted"
    | "sportType"
  >[],
  strength: Pick<
    StrengthSession,
    "sessionDate" | "durationMinutes" | "avgHeartRate"
  >[],
  context: StrainContext,
): DailyStrain[] {
  const days = new Map(
    dates.map((date) => [
      date,
      { date, strain: 0, trimp: 0, sessions: [], unscored: 0 } as DailyStrain,
    ]),
  );
  const add = (
    date: string,
    label: string,
    minutes: number | null,
    avgHeartRate: number | null | undefined,
  ) => {
    const day = days.get(date);
    if (!day) return;
    if (!minutes || avgHeartRate == null) {
      day.unscored += 1;
      return;
    }
    const trimp = banisterTrimp({ minutes, avgHeartRate, ...context });
    day.sessions.push({ label, minutes, avgHeartRate, trimp });
    day.trimp += trimp;
  };

  for (const session of cardio) {
    if (
      session.plannedVsCompleted === "planned" ||
      session.plannedVsCompleted === "skipped"
    ) {
      continue;
    }
    add(
      session.sessionDate,
      session.sportType ?? "Ride",
      session.durationMinutes,
      session.avgHeartRate,
    );
  }
  for (const session of strength) {
    add(
      session.sessionDate,
      "Lift",
      session.durationMinutes,
      session.avgHeartRate,
    );
  }

  return [...days.values()].map((day) => ({
    ...day,
    trimp: Math.round(day.trimp),
    strain: strainFromTrimp(day.trimp),
  }));
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/** "06:30" -> 390. */
function clockMinutes(value: string | null): number | null {
  const match = value ? /^(\d{1,2}):(\d{2})/.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function clockString(minutes: number) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${suffix}`;
}

export type SleepPlan = {
  /** Last night (the row dated today, the wake date), when it synced. */
  lastNight: {
    sleptHours: number;
    needHours: number;
    performancePct: number;
  } | null;
  tonight: {
    needHours: number;
    debtHours: number;
    strainHours: number;
    /** Lights-out for the wake target, never earlier than `earliestBedtime`. */
    inBedBy: string | null;
  };
  /** Spread of wake times over the last 7 nights, minutes (needs 4). */
  wakeSpreadMinutes: number | null;
};

export function buildSleepPlan(input: {
  checkins: Pick<
    RecoveryCheckin,
    | "checkinDate"
    | "sleepDurationMinutes"
    | "timeInBedMinutes"
    | "wakeTimeLocal"
  >[];
  today: string;
  sleepTargetHours: number;
  /** Strain by date; a missing date counts as 0. */
  strainByDate: Map<string, number>;
  wakeTarget: string | null;
  earliestBedtime: string | null;
}): SleepPlan {
  const byDate = new Map(input.checkins.map((c) => [c.checkinDate, c]));
  const sleptHours = (date: string) => {
    const minutes = byDate.get(date)?.sleepDurationMinutes;
    return minutes != null ? minutes / 60 : null;
  };

  /** Need for the night that ends on `wakeDate`. */
  const needFor = (wakeDate: string) => {
    let debt = 0;
    for (let i = 1; i <= DEBT_NIGHTS; i += 1) {
      const slept = sleptHours(addDays(wakeDate, -i));
      if (slept != null) debt += Math.max(0, input.sleepTargetHours - slept);
    }
    const strain = input.strainByDate.get(addDays(wakeDate, -1)) ?? 0;
    const strainHours = (strain / STRAIN_MAX) * STRAIN_SLEEP_MAX_HOURS;
    const debtHours = Math.min(DEBT_REPAY_MAX_HOURS, debt * DEBT_REPAY_SHARE);
    return {
      needHours: input.sleepTargetHours + strainHours + debtHours,
      debtHours,
      strainHours,
    };
  };

  const slept = sleptHours(input.today);
  const lastNeed = needFor(input.today).needHours;
  const lastNight =
    slept != null
      ? {
          sleptHours: round1(slept),
          needHours: round1(lastNeed),
          performancePct: Math.min(100, Math.round((slept / lastNeed) * 100)),
        }
      : null;

  const tonight = needFor(addDays(input.today, 1));

  const week = Array.from({ length: 7 }, (_, i) =>
    byDate.get(addDays(input.today, -i)),
  );
  const efficiencies = week
    .filter(
      (c) =>
        c?.sleepDurationMinutes != null &&
        c.timeInBedMinutes != null &&
        c.timeInBedMinutes > 0,
    )
    .map((c) => Math.min(1, c!.sleepDurationMinutes! / c!.timeInBedMinutes!));
  const efficiency =
    efficiencies.length >= 3 ? median(efficiencies) : DEFAULT_SLEEP_EFFICIENCY;

  const wake = clockMinutes(input.wakeTarget);
  const floor = clockMinutes(input.earliestBedtime);
  let inBedBy: string | null = null;
  if (wake != null) {
    let bed = wake - (tonight.needHours / efficiency) * 60;
    if (bed < 0) bed += 1440;
    // An earlier lights-out than the floor goes against the plan's
    // sleepy-gated bedtime, so cap it there.
    if (floor != null && bed < floor && bed > 12 * 60) bed = floor;
    inBedBy = clockString(bed);
  }

  const wakes = week
    .map((c) => clockMinutes(c?.wakeTimeLocal ?? null))
    .filter((v): v is number => v != null);
  let wakeSpreadMinutes: number | null = null;
  if (wakes.length >= 4) {
    const mean = wakes.reduce((s, v) => s + v, 0) / wakes.length;
    wakeSpreadMinutes = Math.round(
      Math.sqrt(wakes.reduce((s, v) => s + (v - mean) ** 2, 0) / wakes.length),
    );
  }

  return {
    lastNight,
    tonight: {
      needHours: round1(tonight.needHours),
      debtHours: round1(tonight.debtHours),
      strainHours: round1(tonight.strainHours),
      inBedBy,
    },
    wakeSpreadMinutes,
  };
}
