import type {
  AppleHealthDailyMetricsPayload,
  AppleHealthSleepPayload,
  AppleHealthWorkoutPayload,
} from "@fitness-app/jobs";
import type { WatchStrengthWorkout } from "@fitness-app/application";

/**
 * Maps Health Auto Export's REST automation JSON ({ data: { metrics,
 * workouts } }) onto the payloads the three existing Apple Health
 * orchestrators already take, so the app accepts that app's native format
 * without a phone-side transform.
 *
 * Overnight metrics: a second automation can send HRV, heart rate,
 * respiratory rate, blood oxygen and sleeping wrist temperature grouped by
 * hour. Hourly points from 23:00 to 05:59 local are averaged onto the wake
 * date's sleep_* fields (a fixed core-sleep window, so every night is measured
 * the same way and partial pushes are overwritten by fuller ones). A metric
 * counts as hourly when any point carries a clock time other than midnight or
 * two points share a date; daily HRV keeps feeding `hrv` as before.
 *
 * What is deliberately dropped:
 * - Weight and body fat: Withings syncs directly and outranks a relay.
 * - Workouts that are neither rides nor strength: Watch walks would count as
 *   Zone 2. Strength workouts are kept apart (`strengthWorkouts`) and merged
 *   into the day's lift session rather than imported as cardio.
 * - A ride that overlaps another ride in the same batch by more than half
 *   (Peloton and the Watch both writing the same session): the one with
 *   heart rate, else the longer one, is kept.
 */

type Quantity = { qty?: number; units?: string };

type HaeMetricPoint = {
  date?: string;
  qty?: number;
  Avg?: number;
  Min?: number;
  Max?: number;
  totalSleep?: number;
  asleep?: number;
  core?: number;
  deep?: number;
  rem?: number;
  awake?: number;
  inBed?: number;
  inBedStart?: string;
  inBedEnd?: string;
  sleepStart?: string;
  sleepEnd?: string;
};

type HaeMetric = { name?: string; units?: string; data?: HaeMetricPoint[] };

type HaeWorkout = {
  id?: string;
  name?: string;
  start?: string;
  end?: string;
  duration?: number;
  distance?: Quantity;
  avgHeartRate?: Quantity;
  maxHeartRate?: Quantity;
  heartRate?: { avg?: Quantity; max?: Quantity };
  activeEnergyBurned?: Quantity;
  activeEnergy?: Quantity;
};

export type HealthAutoExportBody = {
  data?: { metrics?: HaeMetric[]; workouts?: HaeWorkout[] };
};

export type MappedHealthAutoExport = {
  dailyMetrics: AppleHealthDailyMetricsPayload[];
  sleep: AppleHealthSleepPayload[];
  workouts: AppleHealthWorkoutPayload[];
  /** Watch strength workouts; merged into that day's lift session. */
  strengthWorkouts: WatchStrengthWorkout[];
};

/** HealthKit names: Traditional/Functional Strength Training, Core Training. */
export const STRENGTH_PATTERN =
  /strength|weight ?lifting|functional training|core training/i;
export const RIDE_PATTERN = /cycl|bike|biking|ride|peloton|spin/i;
const KJ_PER_KCAL = 4.184;
const METERS = { km: 1000, mi: 1609.344, m: 1 } as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** "2026-06-11 00:00:00 +0200" or "2026-06-11" -> "2026-06-11". */
function toIsoDate(value: string | undefined): string | null {
  const match = value ? /^(\d{4}-\d{2}-\d{2})/.exec(value) : null;
  return match?.[1] ?? null;
}

/** "2026-08-10 17:08:29 +0200" -> "2026-08-10T17:08:29+02:00". */
export function toIsoDateTime(value: string | undefined): string | null {
  if (!value) return null;
  const match =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(
      value.trim(),
    );
  if (!match) return null;
  const [, date, time, zone] = match;
  const offset =
    !zone || zone === "Z"
      ? "Z"
      : zone.includes(":")
        ? zone
        : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  return `${date}T${time}${offset}`;
}

function minutesBetween(start?: string, end?: string): number | null {
  const a = Date.parse(toIsoDateTime(start) ?? "");
  const b = Date.parse(toIsoDateTime(end) ?? "");
  return Number.isFinite(a) && Number.isFinite(b) && b > a
    ? (b - a) / 60000
    : null;
}

/** "2026-10-11 21:42:10 -0500" -> "21:42", the phone's local clock time. */
export function toLocalClockTime(value: string | undefined): string | null {
  const match = value
    ? /^\d{4}-\d{2}-\d{2}[ T]([01]\d|2[0-3]):([0-5]\d)/.exec(value.trim())
    : null;
  return match ? `${match[1]}:${match[2]}` : null;
}

function hoursToMinutes(units: string | undefined, value: unknown) {
  if (!isFiniteNumber(value)) return undefined;
  return Math.min(1440, Math.round(units === "min" ? value : value * 60));
}

const OVERNIGHT_METRICS = new Set([
  "heart_rate_variability",
  "heart_rate",
  "respiratory_rate",
  "blood_oxygen_saturation",
  "apple_sleeping_wrist_temperature",
]);

/** Hours (local) counted as overnight; 23:00 belongs to the next date. */
const OVERNIGHT_HOURS = new Set([23, 0, 1, 2, 3, 4, 5]);

/** The local clock hour of "2026-10-13 02:00:00 -0500", or null. */
function localHour(value: string | undefined): number | null {
  const clock = toLocalClockTime(value);
  return clock ? Number(clock.slice(0, 2)) : null;
}

/** True when a metric's points are intraday (hourly or raw), not daily. */
function isIntraday(metric: HaeMetric): boolean {
  const dates = new Set<string>();
  for (const point of metric.data ?? []) {
    const clock = toLocalClockTime(point.date);
    if (clock && clock !== "00:00") return true;
    const date = toIsoDate(point.date);
    if (date && dates.has(date)) return true;
    if (date) dates.add(date);
  }
  return false;
}

function addDaysIso(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The wake date a night-time point belongs to: evening rolls forward. */
function nightDate(value: string | undefined): string | null {
  const date = toIsoDate(value);
  const hour = localHour(value);
  if (!date || hour == null) return date;
  return hour >= 15 ? addDaysIso(date, 1) : date;
}

type OvernightField =
  | "sleep_hrv_avg"
  | "sleep_avg_heart_rate"
  | "sleep_respiratory_rate"
  | "sleep_spo2_avg_pct"
  | "sleep_wrist_temp_c";

function overnightValue(
  name: string,
  units: string | undefined,
  point: HaeMetricPoint,
): { field: OvernightField; value: number } | null {
  const qty = point.qty ?? point.Avg;
  if (!isFiniteNumber(qty)) return null;
  switch (name) {
    case "heart_rate_variability":
      return qty > 0 ? { field: "sleep_hrv_avg", value: qty } : null;
    case "heart_rate":
      return qty >= 20 && qty <= 250
        ? { field: "sleep_avg_heart_rate", value: qty }
        : null;
    case "respiratory_rate":
      return qty > 0 && qty < 60
        ? { field: "sleep_respiratory_rate", value: qty }
        : null;
    case "blood_oxygen_saturation": {
      const pct = qty <= 1 ? qty * 100 : qty;
      return pct > 50 && pct <= 100
        ? { field: "sleep_spo2_avg_pct", value: pct }
        : null;
    }
    case "apple_sleeping_wrist_temperature": {
      const celsius = /f/i.test(units ?? "") ? ((qty - 32) * 5) / 9 : qty;
      return celsius > 25 && celsius < 45
        ? { field: "sleep_wrist_temp_c", value: celsius }
        : null;
    }
    default:
      return null;
  }
}

const OVERNIGHT_ROUNDING: Record<OvernightField, (v: number) => number> = {
  sleep_hrv_avg: (v) => Math.round(v * 10) / 10,
  sleep_avg_heart_rate: (v) => Math.round(v),
  sleep_respiratory_rate: (v) => Math.round(v * 10) / 10,
  sleep_spo2_avg_pct: (v) => Math.round(v * 10) / 10,
  sleep_wrist_temp_c: (v) => Math.round(v * 100) / 100,
};

function mapDailyAndSleep(metrics: HaeMetric[]) {
  const daily = new Map<string, AppleHealthDailyMetricsPayload>();
  const sleep = new Map<string, AppleHealthSleepPayload>();
  const dailyFor = (date: string) => {
    const row = daily.get(date) ?? { date };
    daily.set(date, row);
    return row;
  };
  const sleepFor = (date: string) => {
    const row = sleep.get(date) ?? { date };
    sleep.set(date, row);
    return row;
  };

  // date -> field -> readings, averaged once every metric is read.
  const overnight = new Map<string, Map<OvernightField, number[]>>();

  for (const metric of metrics) {
    const name = metric.name ?? "";
    if (isIntraday(metric)) {
      for (const point of metric.data ?? []) {
        const reading = overnightValue(name, metric.units, point);
        const hour = localHour(point.date);
        const date = nightDate(point.date);
        if (!reading || hour == null || !date) continue;
        // Wrist temperature is one reading per night, whenever it is stamped.
        if (
          reading.field !== "sleep_wrist_temp_c" &&
          !OVERNIGHT_HOURS.has(hour)
        ) {
          continue;
        }
        const fields = overnight.get(date) ?? new Map();
        overnight.set(date, fields);
        fields.set(reading.field, [
          ...(fields.get(reading.field) ?? []),
          reading.value,
        ]);
      }
      if (OVERNIGHT_METRICS.has(name)) continue;
    }
    for (const point of metric.data ?? []) {
      const date = toIsoDate(point.date);
      if (!date) continue;
      const qty = point.qty ?? point.Avg;

      if (name === "step_count" && isFiniteNumber(qty)) {
        const row = dailyFor(date);
        row.steps = Math.round((row.steps ?? 0) + qty);
      } else if (name === "resting_heart_rate" && isFiniteNumber(qty)) {
        // Also on the recovery check-in, which is what /recovery charts.
        dailyFor(date).resting_heart_rate = qty;
        sleepFor(date).resting_heart_rate = qty;
      } else if (
        (name === "vo2_max" || name === "vo2max") &&
        isFiniteNumber(qty) &&
        qty > 0
      ) {
        dailyFor(date).vo2_max = qty;
      } else if (name === "apple_exercise_time" && isFiniteNumber(qty)) {
        const row = dailyFor(date);
        row.exercise_minutes = Math.min(
          1440,
          (row.exercise_minutes ?? 0) + qty,
        );
      } else if (name === "active_energy" && isFiniteNumber(qty)) {
        const kcal = metric.units === "kJ" ? qty / KJ_PER_KCAL : qty;
        const row = dailyFor(date);
        row.active_energy_kcal = (row.active_energy_kcal ?? 0) + kcal;
      } else if (name === "heart_rate_variability" && isFiniteNumber(qty)) {
        sleepFor(date).hrv = qty;
      } else if (name === "sleep_analysis") {
        const row = sleepFor(date);
        const staged = (point.core ?? 0) + (point.deep ?? 0) + (point.rem ?? 0);
        const total = point.totalSleep ?? (staged > 0 ? staged : point.asleep);
        const asleepMinutes = hoursToMinutes(metric.units, total);
        if (asleepMinutes != null && asleepMinutes > 0) {
          row.sleep_duration_minutes = asleepMinutes;
        }
        row.deep_sleep_minutes = hoursToMinutes(metric.units, point.deep);
        row.rem_sleep_minutes = hoursToMinutes(metric.units, point.rem);
        row.core_sleep_minutes = hoursToMinutes(metric.units, point.core);
        row.awake_minutes = hoursToMinutes(metric.units, point.awake);
        const inBed =
          hoursToMinutes(metric.units, point.inBed) ||
          minutesBetween(point.inBedStart, point.inBedEnd) ||
          minutesBetween(point.sleepStart, point.sleepEnd);
        if (inBed) row.time_in_bed_minutes = Math.min(1440, Math.round(inBed));
        // Watch-measured sleep onset and wake, falling back to the iPhone's
        // in-bed window. Onset runs a few minutes after lights out.
        const bedtime =
          toLocalClockTime(point.sleepStart) ??
          toLocalClockTime(point.inBedStart);
        const wake =
          toLocalClockTime(point.sleepEnd) ?? toLocalClockTime(point.inBedEnd);
        if (bedtime) row.bedtime_local = bedtime;
        if (wake) row.wake_time_local = wake;
      }
    }
  }

  for (const [date, fields] of overnight) {
    const row = sleepFor(date);
    for (const [field, values] of fields) {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      row[field] = OVERNIGHT_ROUNDING[field](mean);
    }
  }

  return {
    dailyMetrics: [...daily.values()].map((row) =>
      row.active_energy_kcal != null
        ? {
            ...row,
            active_energy_kcal: Math.round(row.active_energy_kcal * 10) / 10,
          }
        : row,
    ),
    sleep: [...sleep.values()].map(
      (row) =>
        Object.fromEntries(
          Object.entries(row).filter(([, value]) => value !== undefined),
        ) as AppleHealthSleepPayload,
    ),
  };
}

function quantity(value: Quantity | undefined): number | undefined {
  return isFiniteNumber(value?.qty) && value.qty > 0 ? value.qty : undefined;
}

function mapWorkout(workout: HaeWorkout): AppleHealthWorkoutPayload | null {
  const name = workout.name?.trim();
  const start = toIsoDateTime(workout.start);
  if (!name || !start || !RIDE_PATTERN.test(name)) return null;
  const end = toIsoDateTime(workout.end) ?? undefined;
  const durationMinutes = isFiniteNumber(workout.duration)
    ? Math.min(1440, Math.round(workout.duration / 60))
    : undefined;
  const distance = quantity(workout.distance);
  const distanceUnits = workout.distance?.units as keyof typeof METERS;

  return {
    // Export v1 has no id; start time is unique per workout.
    workout_id: workout.id?.trim() || `hae:${name}:${start}`,
    workout_type: name,
    session_kind: "zone2",
    start,
    end,
    duration_minutes: durationMinutes,
    avg_heart_rate:
      quantity(workout.avgHeartRate) ?? quantity(workout.heartRate?.avg),
    max_heart_rate:
      quantity(workout.maxHeartRate) ?? quantity(workout.heartRate?.max),
    distance_meters:
      distance != null && METERS[distanceUnits]
        ? Math.round(distance * METERS[distanceUnits])
        : undefined,
    source_name: "Health Auto Export",
  };
}

function rangeOf(workout: AppleHealthWorkoutPayload) {
  const start = Date.parse(workout.start);
  const end = workout.end
    ? Date.parse(workout.end)
    : start + (workout.duration_minutes ?? 0) * 60000;
  return { start, end };
}

/** Drops the weaker of two rides that overlap by more than half. */
export function dedupeOverlappingRides(
  workouts: AppleHealthWorkoutPayload[],
): AppleHealthWorkoutPayload[] {
  const kept: AppleHealthWorkoutPayload[] = [];
  const score = (w: AppleHealthWorkoutPayload) =>
    (w.avg_heart_rate != null ? 1e6 : 0) + (rangeOf(w).end - rangeOf(w).start);

  for (const workout of [...workouts].sort((a, b) =>
    a.start.localeCompare(b.start),
  )) {
    const a = rangeOf(workout);
    const clashIndex = kept.findIndex((other) => {
      const b = rangeOf(other);
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      const shorter = Math.min(a.end - a.start, b.end - b.start);
      return shorter > 0 && overlap > shorter / 2;
    });
    if (clashIndex === -1) {
      kept.push(workout);
    } else if (score(workout) > score(kept[clashIndex]!)) {
      kept[clashIndex] = workout;
    }
  }
  return kept;
}

function toKcal(value: Quantity | undefined): number | null {
  const qty = quantity(value);
  if (qty == null) return null;
  const units = value?.units?.toLowerCase() ?? "kcal";
  const kcal = Math.round(units === "kj" ? qty / KJ_PER_KCAL : qty);
  return kcal <= 5000 ? kcal : null;
}

/** Rounded heart rate, or null when absent or outside 20-250 bpm. */
function bpmOrNull(value: number | undefined): number | null {
  if (value == null) return null;
  const bpm = Math.round(value);
  return bpm >= 20 && bpm <= 250 ? bpm : null;
}

function mapStrengthWorkout(workout: HaeWorkout): WatchStrengthWorkout | null {
  const name = workout.name?.trim();
  const startedAt = toIsoDateTime(workout.start);
  // The export's local wall-clock date ("2026-10-12 17:30:00 -0500").
  const localDate = toIsoDate(workout.start);
  if (!name || !startedAt || !localDate || !STRENGTH_PATTERN.test(name)) {
    return null;
  }
  const minutes = isFiniteNumber(workout.duration)
    ? Math.round(workout.duration / 60)
    : null;
  return {
    externalId: workout.id?.trim() || `hae:${name}:${startedAt}`,
    workoutType: name,
    localDate,
    startedAt,
    endedAt: toIsoDateTime(workout.end) ?? null,
    durationMinutes:
      minutes != null && minutes >= 1 ? Math.min(600, minutes) : null,
    avgHeartRate: bpmOrNull(
      quantity(workout.avgHeartRate) ?? quantity(workout.heartRate?.avg),
    ),
    maxHeartRate: bpmOrNull(
      quantity(workout.maxHeartRate) ?? quantity(workout.heartRate?.max),
    ),
    activeEnergyKcal: toKcal(
      workout.activeEnergyBurned ?? workout.activeEnergy,
    ),
  };
}

export function mapHealthAutoExport(
  body: HealthAutoExportBody,
): MappedHealthAutoExport {
  const { dailyMetrics, sleep } = mapDailyAndSleep(body.data?.metrics ?? []);
  const workouts = dedupeOverlappingRides(
    (body.data?.workouts ?? [])
      .map(mapWorkout)
      .filter((w): w is AppleHealthWorkoutPayload => w != null),
  );
  const strengthWorkouts = (body.data?.workouts ?? [])
    .map(mapStrengthWorkout)
    .filter((w): w is WatchStrengthWorkout => w != null);
  return { dailyMetrics, sleep, workouts, strengthWorkouts };
}
