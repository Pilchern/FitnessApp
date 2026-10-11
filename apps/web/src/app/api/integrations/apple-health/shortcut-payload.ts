import type {
  AppleHealthDailyMetricsPayload,
  AppleHealthSleepPayload,
  AppleHealthWorkoutPayload,
} from "@fitness-app/jobs";
import {
  RIDE_PATTERN,
  dedupeOverlappingRides,
  toIsoDateTime,
} from "./health-auto-export";

/**
 * One request from one iPhone Shortcut (see
 * docs/integrations/apple-health-bridge-setup.md): today's activity, last
 * night's sleep and recent workouts, mapped onto the payloads the existing
 * daily-metrics, sleep and workout orchestrators take.
 *
 * Shortcuts is loose about types, so this is too: numbers may arrive as text
 * or with units ("58 count/min", "7,210"), and an empty variable arrives as
 * "". Those are read leniently and blanks are skipped. Anything that cannot
 * be read is reported back in `warnings` instead of failing the whole sync,
 * so tapping Run in Shortcuts shows exactly what landed and what did not.
 */

export type ShortcutWorkoutInput = {
  id?: unknown;
  type?: unknown;
  start?: unknown;
  end?: unknown;
  duration_minutes?: unknown;
  duration_seconds?: unknown;
  avg_heart_rate?: unknown;
  max_heart_rate?: unknown;
  distance_meters?: unknown;
  distance_km?: unknown;
  distance_miles?: unknown;
};

export type ShortcutBody = {
  date?: unknown;
  steps?: unknown;
  resting_heart_rate?: unknown;
  hrv?: unknown;
  vo2_max?: unknown;
  exercise_minutes?: unknown;
  active_energy_kcal?: unknown;
  sleep_minutes?: unknown;
  sleep_hours?: unknown;
  workouts?: unknown;
};

export type MappedShortcut = {
  date: string;
  dailyMetrics: AppleHealthDailyMetricsPayload | null;
  sleep: AppleHealthSleepPayload | null;
  workouts: AppleHealthWorkoutPayload[];
  /** Workouts dropped because they are not rides (walks, strength). */
  skippedWorkouts: number;
  warnings: string[];
};

/** 7210, "7,210", "58 count/min", "40.1 mL/kg·min" -> number; "" -> undefined. */
export function readNumber(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = /-?\d[\d,]*(?:\.\d+)?/.exec(value.trim());
  if (!match) return undefined;
  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * A night's sleep or a ride's length in minutes, whatever unit the Shortcut
 * produced: up to 24 is hours, over 1440 is seconds, anything else minutes.
 */
export function toMinutes(value: number | undefined): number | undefined {
  if (value == null || value <= 0) return undefined;
  if (value <= 24) return value * 60;
  if (value > 1440) return value / 60;
  return value;
}

function readText(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function readDate(value: unknown): string | undefined {
  const match = readText(value)?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

/** Workouts arrive as a list, or as one dictionary when there was a single one. */
function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function mapWorkout(
  raw: ShortcutWorkoutInput,
  index: number,
  warnings: string[],
): AppleHealthWorkoutPayload | "skipped" | null {
  const type = readText(raw.type);
  const start = toIsoDateTime(readText(raw.start));
  if (!type || !start) {
    warnings.push(
      `workout ${index + 1}: needs a type and a start in ISO 8601 (Format Date > ISO 8601)`,
    );
    return null;
  }
  if (!RIDE_PATTERN.test(type)) return "skipped";

  const end = toIsoDateTime(readText(raw.end)) ?? undefined;
  const seconds = readNumber(raw.duration_seconds);
  const minutes =
    toMinutes(readNumber(raw.duration_minutes)) ??
    (seconds != null ? seconds / 60 : undefined);
  const meters =
    readNumber(raw.distance_meters) ??
    (readNumber(raw.distance_km) != null
      ? readNumber(raw.distance_km)! * 1000
      : readNumber(raw.distance_miles) != null
        ? readNumber(raw.distance_miles)! * 1609.344
        : undefined);
  const positive = (n: number | undefined) =>
    n != null && n > 0 ? n : undefined;

  return {
    workout_id: readText(raw.id) ?? `shortcut:${type}:${start}`,
    workout_type: type,
    session_kind: "zone2",
    start,
    end,
    duration_minutes:
      minutes != null ? Math.min(1440, Math.round(minutes)) : undefined,
    avg_heart_rate: positive(readNumber(raw.avg_heart_rate)),
    max_heart_rate: positive(readNumber(raw.max_heart_rate)),
    distance_meters: meters != null ? Math.round(meters) : undefined,
    source_name: "Apple Health (Shortcut)",
  };
}

export function mapShortcutBody(
  body: ShortcutBody,
  today: string,
): MappedShortcut {
  const warnings: string[] = [];
  const date = readDate(body.date) ?? today;

  const steps = readNumber(body.steps);
  const rhr = readNumber(body.resting_heart_rate);
  const vo2 = readNumber(body.vo2_max);
  const exercise = readNumber(body.exercise_minutes);
  const energy = readNumber(body.active_energy_kcal);
  const hrv = readNumber(body.hrv);
  const sleepMinutes =
    toMinutes(readNumber(body.sleep_minutes)) ??
    (readNumber(body.sleep_hours) != null
      ? readNumber(body.sleep_hours)! * 60
      : undefined);

  const daily: AppleHealthDailyMetricsPayload = { date };
  if (steps != null && steps >= 0) daily.steps = Math.round(steps);
  if (rhr != null && rhr > 0) daily.resting_heart_rate = rhr;
  if (vo2 != null && vo2 > 0) daily.vo2_max = vo2;
  if (exercise != null && exercise >= 0)
    daily.exercise_minutes = Math.min(1440, exercise);
  if (energy != null && energy >= 0) daily.active_energy_kcal = energy;

  // Last night's sleep belongs to the date you woke up, which is `date` for a
  // run later the same day. Resting HR and HRV also go on the recovery
  // check-in, which is what /recovery charts.
  const sleep: AppleHealthSleepPayload = { date };
  if (sleepMinutes != null && sleepMinutes > 0)
    sleep.sleep_duration_minutes = Math.min(1440, Math.round(sleepMinutes));
  if (hrv != null && hrv > 0) sleep.hrv = hrv;
  if (rhr != null && rhr > 0) sleep.resting_heart_rate = rhr;

  let skippedWorkouts = 0;
  const rides: AppleHealthWorkoutPayload[] = [];
  asList(body.workouts).forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const mapped = mapWorkout(raw as ShortcutWorkoutInput, index, warnings);
    if (mapped === "skipped") skippedWorkouts += 1;
    else if (mapped) rides.push(mapped);
  });

  return {
    date,
    dailyMetrics: Object.keys(daily).length > 1 ? daily : null,
    sleep: Object.keys(sleep).length > 1 ? sleep : null,
    workouts: dedupeOverlappingRides(rides),
    skippedWorkouts,
    warnings,
  };
}
