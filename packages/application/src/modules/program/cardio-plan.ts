import type { IsoDate } from "@fitness-app/domain";
import { daysBetween } from "./program-calendar";
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
