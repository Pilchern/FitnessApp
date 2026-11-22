import type {
  CardioSession,
  IsoDate,
  KneeReadinessStatus,
  RideKind,
} from "@fitness-app/domain";
import { addDays, daysBetween } from "./program-calendar";
import type { ProgramSettings } from "./program-settings";

/**
 * The cardio plan's week-by-week numbers (from 2026-11-16): VO2 work
 * interval length, Saturday long ride minutes, and the gated Thursday
 * sprint finisher. Everything comes from Settings; the last value of each
 * list holds once the list runs out.
 */
export type CardioPlanSettings = Pick<
  ProgramSettings,
  | "zone2HrLow"
  | "zone2HrHigh"
  | "vo2TargetHr"
  | "cardioPlanStart"
  | "vo2IntervalMinutesByWeek"
  | "longRideMinutesByWeek"
  | "sprintFinisherCleared"
  | "sprintFinisherFromWeek"
>;

/** "3, 3, 4" -> [3, 3, 4]; blanks and non-positive entries drop out. */
export function parseMinutesList(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** 1-based cardio week holding `date`, or null before the plan starts. */
export function cardioWeek(
  settings: Pick<CardioPlanSettings, "cardioPlanStart">,
  date: IsoDate,
): number | null {
  if (!settings.cardioPlanStart) return null;
  const days = daysBetween(settings.cardioPlanStart, date);
  return days < 0 ? null : Math.floor(days / 7) + 1;
}

function valueForWeek(list: number[], week: number): number | null {
  if (list.length === 0) return null;
  return list[Math.min(week, list.length) - 1];
}

/** Warm-up and cool-down around the VO2 intervals, minutes. */
export const VO2_WARM_UP_MINUTES = 10;
export const VO2_COOL_DOWN_MINUTES = 5;
export const VO2_INTERVAL_COUNT = 4;

/** The Thursday sprint finisher runs on this weekday (0 = Sunday). */
export const SPRINT_FINISHER_DAY = 4;

export type CardioWeekPlan = {
  week: number;
  /** Work interval length; recovery between intervals is the same. */
  intervalMinutes: number | null;
  /** Warm-up, 4 work, 3 equal recoveries, cool-down. */
  vo2RideMinutes: number | null;
  longRideMinutes: number | null;
  sprintFinisher: boolean;
};

export function cardioWeekPlan(
  settings: CardioPlanSettings,
  date: IsoDate,
): CardioWeekPlan | null {
  const week = cardioWeek(settings, date);
  if (week == null) return null;
  const intervalMinutes = valueForWeek(
    parseMinutesList(settings.vo2IntervalMinutesByWeek),
    week,
  );
  return {
    week,
    intervalMinutes,
    vo2RideMinutes:
      intervalMinutes == null
        ? null
        : VO2_WARM_UP_MINUTES +
          VO2_INTERVAL_COUNT * intervalMinutes +
          (VO2_INTERVAL_COUNT - 1) * intervalMinutes +
          VO2_COOL_DOWN_MINUTES,
    longRideMinutes: valueForWeek(
      parseMinutesList(settings.longRideMinutesByWeek),
      week,
    ),
    sprintFinisher:
      settings.sprintFinisherCleared >= 1 &&
      week >= settings.sprintFinisherFromWeek,
  };
}

export function vo2Structure(intervalMinutes: number) {
  return `${VO2_WARM_UP_MINUTES} min warm-up; ${VO2_INTERVAL_COUNT} x ${intervalMinutes} min hard, ${intervalMinutes} min easy between; ${VO2_COOL_DOWN_MINUTES} min cool-down. Seated, cadence-driven.`;
}

export function zone2Target(
  settings: Pick<CardioPlanSettings, "zone2HrLow" | "zone2HrHigh">,
) {
  return `HR ${settings.zone2HrLow}-${settings.zone2HrHigh} bpm, hard cap ${settings.zone2HrHigh}.`;
}

export function vo2Target(settings: Pick<CardioPlanSettings, "vo2TargetHr">) {
  return `HR ${settings.vo2TargetHr}+ by the end of each interval.`;
}

export const SPRINT_FINISHER =
  "Then 4-6 x 20-30 s all-out, 2-3 min easy between.";

/** Watts a ride goal moves by when the evidence says go up or back off. */
export const RIDE_WATT_STEP = 5;
/** Zone 2 history only counts rides at least this long. */
export const RIDE_GOAL_MIN_MINUTES = 20;
/** VO2: hold the power when the last interval fades below this share of the first. */
export const VO2_FADE_FLOOR = 0.95;
/** Plan rule: hold when morning resting HR is this far over its baseline. */
export const RESTING_HR_HOLD_BPM = 3;
/** Resting HR baseline: median of the mornings in this many days before. */
export const RESTING_HR_BASELINE_DAYS = 28;
const RESTING_HR_MIN_BASELINE = 7;
/** Plan rule: hold when Zone 2 HR rises this much at the same watts in a week. */
export const ZONE2_HR_CREEP_BPM = 3;

/**
 * What can hold a ride's power increase (fitness-health-plan section 5):
 * the morning knee check and resting heart rate by check-in date.
 */
export type RideHoldInput = {
  kneeReadiness?: KneeReadinessStatus | null;
  restingHr?: { checkinDate: IsoDate; restingHeartRate: number | null }[];
};

export type RideHistoryEntry = Pick<
  CardioSession,
  | "sessionDate"
  | "sessionKind"
  | "plannedVsCompleted"
  | "durationMinutes"
  | "avgHeartRate"
  | "avgOutput"
  | "resistanceMin"
  | "resistanceMax"
> &
  Partial<Pick<CardioSession, "intervalOutputs">>;

export type RideGoals = {
  /** Average watts to hold (each work interval on a VO2 ride). */
  watts: number;
  /** Total output at those watts over the ride; null for intervals. */
  kj: number | null;
  cadence: string;
  resistance: string;
  heartRate: string;
  /** Which ride the goal came from and why it moved or held. */
  basis: string;
};

const ZONE2_CADENCE = "85–90 rpm";
const VO2_CADENCE = "95–105 rpm, seated";

function resistanceHint(last: RideHistoryEntry, watts: number) {
  if (last.resistanceMin != null && last.resistanceMax != null) {
    return last.resistanceMin === last.resistanceMax
      ? `${last.resistanceMin} (last ride)`
      : `${last.resistanceMin}–${last.resistanceMax} (last ride)`;
  }
  if (last.resistanceMin != null || last.resistanceMax != null) {
    return `${last.resistanceMin ?? last.resistanceMax} (last ride)`;
  }
  return `set it to whatever holds ${watts} W at that cadence; note the number`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Why a ride's power should not go up on `date`, or null. Knee check not
 * normal; latest resting HR (that morning or the one before) 3+ bpm over
 * the 28-day median; or Zone 2 HR up 3+ bpm at the same or lower watts
 * across the last 7 days.
 */
export function rideHoldReason(
  history: RideHistoryEntry[],
  date: IsoDate,
  hold: RideHoldInput = {},
): string | null {
  if (hold.kneeReadiness != null && hold.kneeReadiness !== "normal") {
    return "knee check not normal";
  }
  const mornings = (hold.restingHr ?? [])
    .filter(
      (r) =>
        r.restingHeartRate != null &&
        r.restingHeartRate > 0 &&
        r.checkinDate <= date,
    )
    .sort((a, b) => b.checkinDate.localeCompare(a.checkinDate));
  const latest = mornings[0];
  if (latest && latest.checkinDate >= addDays(date, -1)) {
    const from = addDays(latest.checkinDate, -RESTING_HR_BASELINE_DAYS);
    const baseline = mornings
      .filter(
        (r) => r.checkinDate < latest.checkinDate && r.checkinDate >= from,
      )
      .map((r) => r.restingHeartRate as number);
    if (baseline.length >= RESTING_HR_MIN_BASELINE) {
      const base = median(baseline);
      const rhr = latest.restingHeartRate as number;
      if (rhr - base >= RESTING_HR_HOLD_BPM) {
        return `resting HR ${rhr} is ${Math.round(rhr - base)} over its ${RESTING_HR_BASELINE_DAYS}-day median (${base})`;
      }
    }
  }
  const week = completedBefore(history, date)
    .filter(
      (r) =>
        r.sessionKind === "zone2" &&
        r.sessionDate >= addDays(date, -7) &&
        (r.durationMinutes ?? 0) >= RIDE_GOAL_MIN_MINUTES &&
        (r.avgOutput ?? 0) > 0 &&
        r.avgHeartRate != null,
    )
    .reverse();
  const first = week[0];
  const last = week[week.length - 1];
  if (
    first &&
    last &&
    first !== last &&
    (last.avgOutput as number) <= (first.avgOutput as number) &&
    (last.avgHeartRate as number) - (first.avgHeartRate as number) >=
      ZONE2_HR_CREEP_BPM
  ) {
    return `Zone 2 HR crept from ${first.avgHeartRate} to ${last.avgHeartRate} bpm at the same watts this week`;
  }
  return null;
}

/** Latest first. */
function completedBefore(history: RideHistoryEntry[], date: IsoDate) {
  return history
    .filter((r) => r.plannedVsCompleted === "completed" && r.sessionDate < date)
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
}

/** True when this cardio week's value for `pick` is above last week's. */
function roseSinceLastWeek(
  settings: CardioPlanSettings,
  date: IsoDate,
  pick: (plan: CardioWeekPlan) => number | null,
) {
  const now = cardioWeekPlan(settings, date);
  const before = cardioWeekPlan(settings, addDays(date, -7));
  const a = now ? pick(now) : null;
  const b = before ? pick(before) : null;
  return a != null && b != null && a > b;
}

/**
 * Power, kJ, cadence, resistance and heart rate goals for a planned ride,
 * from completed rides before `date`. Zone 2: last Zone 2 ride's average
 * watts, -5 W when HR ran over the band, +5 W when it sat below the band
 * midpoint, held the week the long ride gets longer. VO2: mean of the last
 * ride's interval watts, +5 W unless the intervals got longer this week or
 * the last one faded under 95% of the first. Any increase is held by
 * `rideHoldReason` (knee check, resting HR, Zone 2 HR creep). Null without
 * usable history.
 */
export function rideGoals(
  ride: { kind: RideKind; minutesMax: number | null },
  history: RideHistoryEntry[],
  settings: CardioPlanSettings,
  date: IsoDate,
  hold: RideHoldInput = {},
): RideGoals | null {
  const rides = completedBefore(history, date);
  const holdReason = () => rideHoldReason(history, date, hold);
  if (ride.kind === "zone2" || ride.kind === "zone2_long") {
    const last = rides.find(
      (r) =>
        r.sessionKind === "zone2" &&
        (r.durationMinutes ?? 0) >= RIDE_GOAL_MIN_MINUTES &&
        (r.avgOutput ?? 0) > 0,
    );
    if (!last) return null;
    const base = Math.round(last.avgOutput as number);
    const hr = last.avgHeartRate;
    const mid = (settings.zone2HrLow + settings.zone2HrHigh) / 2;
    let delta = 0;
    let why: string;
    if (hr != null && hr > settings.zone2HrHigh) {
      delta = -RIDE_WATT_STEP;
      why = `HR ${hr} ran over ${settings.zone2HrHigh}: back off ${RIDE_WATT_STEP} W`;
    } else if (
      ride.kind === "zone2_long" &&
      roseSinceLastWeek(settings, date, (p) => p.longRideMinutes)
    ) {
      why = "the long ride got longer this week: hold the power";
    } else if (hr != null && hr < mid) {
      const held = holdReason();
      delta = held ? 0 : RIDE_WATT_STEP;
      why = held
        ? `HR ${hr} sat below the band midpoint (${mid}), but ${held}: hold`
        : `HR ${hr} sat below the band midpoint (${mid}): up ${RIDE_WATT_STEP} W`;
    } else {
      why = hr == null ? "no HR logged: hold" : `HR ${hr} in the band: hold`;
    }
    const watts = base + delta;
    return {
      watts,
      kj:
        ride.minutesMax != null
          ? Math.round((watts * ride.minutesMax * 60) / 1000)
          : null,
      cadence: ZONE2_CADENCE,
      resistance: resistanceHint(last, watts),
      heartRate: `${settings.zone2HrLow}–${settings.zone2HrHigh} bpm, hard cap ${settings.zone2HrHigh}`,
      basis: `Last Zone 2 (${last.sessionDate}): ${base} W avg; ${why}.`,
    };
  }
  if (ride.kind === "vo2_intervals") {
    const last = rides.find((r) => (r.intervalOutputs?.length ?? 0) > 0);
    const outputs = last?.intervalOutputs;
    if (!last || !outputs || outputs.length === 0) return null;
    const base = Math.round(
      outputs.reduce((a, b) => a + b, 0) / outputs.length,
    );
    const first = outputs[0] as number;
    const final = outputs[outputs.length - 1] as number;
    let delta = 0;
    let why: string;
    if (roseSinceLastWeek(settings, date, (p) => p.intervalMinutes)) {
      why = "intervals got longer this week: hold the power";
    } else if (first > 0 && final / first >= VO2_FADE_FLOOR) {
      const held = holdReason();
      delta = held ? 0 : RIDE_WATT_STEP;
      why = held
        ? `held to the last interval, but ${held}: hold`
        : `held to the last interval: up ${RIDE_WATT_STEP} W`;
    } else {
      why = `last interval faded to ${final} from ${first}: hold`;
    }
    const watts = base + delta;
    return {
      watts,
      kj: null,
      cadence: VO2_CADENCE,
      resistance: resistanceHint(last, watts),
      heartRate: `${settings.vo2TargetHr}+ bpm by the end of each interval`,
      basis: `Last VO2 (${last.sessionDate}): intervals ${outputs.join(", ")} W, mean ${base}; ${why}.`,
    };
  }
  return null;
}

/** The goal lines the today card shows, in order. */
export function rideGoalLines(goals: RideGoals, kind: RideKind): string[] {
  const output =
    kind === "vo2_intervals"
      ? `Output: ${goals.watts} W avg on each work interval`
      : `Output: ${goals.watts} W avg${goals.kj != null ? `, about ${goals.kj} kJ` : ""}`;
  return [
    output,
    `Cadence: ${goals.cadence}`,
    `Resistance: ${goals.resistance}`,
    `Heart rate: ${goals.heartRate}`,
    goals.basis,
  ];
}
