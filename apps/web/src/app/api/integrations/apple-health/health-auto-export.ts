import type {
  AppleHealthDailyMetricsPayload,
  AppleHealthSleepPayload,
  AppleHealthWorkoutPayload,
} from "@fitness-app/jobs";

/**
 * Maps Health Auto Export's REST automation JSON ({ data: { metrics,
 * workouts } }) onto the payloads the three existing Apple Health
 * orchestrators already take, so the app accepts that app's native format
 * without a phone-side transform.
 *
 * What is deliberately dropped:
 * - Weight and body fat: Withings syncs directly and outranks a relay.
 * - Workouts that are not rides: Watch walks would count as Zone 2 and Watch
 *   strength sessions would double-count lifts logged in the app.
 * - A ride that overlaps another ride in the same batch by more than half
 *   (Peloton and the Watch both writing the same session): the one with
 *   heart rate, else the longer one, is kept.
 */

type Quantity = { qty?: number; units?: string };

type HaeMetricPoint = {
  date?: string;
  qty?: number;
  Avg?: number;
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
};

export type HealthAutoExportBody = {
  data?: { metrics?: HaeMetric[]; workouts?: HaeWorkout[] };
};

export type MappedHealthAutoExport = {
  dailyMetrics: AppleHealthDailyMetricsPayload[];
  sleep: AppleHealthSleepPayload[];
  workouts: AppleHealthWorkoutPayload[];
};

const RIDE_PATTERN = /cycl|bike|biking|ride|peloton|spin/i;
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

function hoursToMinutes(units: string | undefined, value: unknown) {
  if (!isFiniteNumber(value)) return undefined;
  return Math.min(1440, Math.round(units === "min" ? value : value * 60));
}

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

  for (const metric of metrics) {
    const name = metric.name ?? "";
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
      }
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

export function mapHealthAutoExport(
  body: HealthAutoExportBody,
): MappedHealthAutoExport {
  const { dailyMetrics, sleep } = mapDailyAndSleep(body.data?.metrics ?? []);
  const workouts = dedupeOverlappingRides(
    (body.data?.workouts ?? [])
      .map(mapWorkout)
      .filter((w): w is AppleHealthWorkoutPayload => w != null),
  );
  return { dailyMetrics, sleep, workouts };
}
