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
 *   power, else heart rate, else the longer one, is kept, and it borrows the
 *   fields it lacks from the other copy.
 *
 * Zone 2: credited by the band `zone2CreditBy` names (power by default,
 * heart rate while the FTP is stale). Power mode falls back to heart rate;
 * heart rate mode has no fallback.
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
  /** Per-interval heart rate during the workout (v2 "heartRateData"). */
  heartRateData?: {
    date?: string;
    Avg?: number;
    qty?: number;
    source?: string;
  }[];
  /** Per-sample power in watts (v2, "Include Workout Metrics"). Peloton writes it. */
  cyclingPower?: {
    date?: string;
    qty?: number;
    units?: string;
    source?: string;
  }[];
  activeEnergyBurned?: Quantity;
  activeEnergy?: Quantity;
};

export type HealthAutoExportBody = {
  data?: { metrics?: HaeMetric[]; workouts?: HaeWorkout[] };
};

export type MappedHealthAutoExport = {
  dailyMetrics: AppleHealthDailyMetricsPayload[];
  /** Daylight minutes from 05:00 to 09:59 local, per date (hourly exports only). */
  morningDaylight: { date: string; minutes: number }[];
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

/** Morning light window for the sunlight habit: 05:00 to 09:59 local. */
const MORNING_START_HOUR = 5;
const MORNING_END_HOUR = 10;

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
  const morningDaylight = new Map<string, number>();

  for (const metric of metrics) {
    const name = metric.name ?? "";
    if (name === "time_in_daylight") {
      // Only an hourly export says when the light was; a daily total is
      // ignored rather than credited to the morning.
      if (!isIntraday(metric)) continue;
      for (const point of metric.data ?? []) {
        const hour = localHour(point.date);
        const date = toIsoDate(point.date);
        const qty = point.qty;
        if (date == null || hour == null || !isFiniteNumber(qty)) continue;
        if (hour < MORNING_START_HOUR || hour >= MORNING_END_HOUR) continue;
        const minutes = metric.units === "hr" ? qty * 60 : qty;
        morningDaylight.set(date, (morningDaylight.get(date) ?? 0) + minutes);
      }
      continue;
    }
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
    morningDaylight: [...morningDaylight.entries()].map(([date, minutes]) => ({
      date,
      minutes: Math.round(minutes),
    })),
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

export type HealthAutoExportOptions = {
  /** Zone 2 heart rate band, bpm; rides with per-interval HR get real minutes. */
  zone2Bpm?: [number, number] | null;
  /** Zone 2 power band, watts; wins over heart rate when a ride has power. */
  zone2Watts?: [number, number] | null;
  /**
   * Which band credits Zone 2 minutes: "power" (default, heart rate as the
   * fallback) or "heart_rate" (no fallback).
   */
  zone2CreditBy?: "power" | "heart_rate";
};

/**
 * Minutes inside the Zone 2 band from per-interval workout heart rate. Each
 * reading covers the gap to the next one (capped at 5 min, 1 min for the
 * last), so the total tracks the ride even if the export interval changes.
 */
export function zone2MinutesFromHeartRate(
  data: HaeWorkout["heartRateData"],
  band: [number, number],
): number | null {
  const points = timedPoints(
    (data ?? []).map((p) => ({ date: p.date, value: p.Avg ?? p.qty })),
  );
  return points ? Math.round(minutesInBand(points, band)) : null;
}

type TimedPoint = { at: number; value: number; span: number };

/**
 * Sorted readings with the minutes each one covers: the gap to the next
 * reading, capped at 5 min; the last covers the previous gap, capped at 1.
 * Null with fewer than two readings.
 */
function timedPoints(
  raw: { date?: string; value?: number }[],
): TimedPoint[] | null {
  const points = raw
    .map((p) => ({
      at: Date.parse(toIsoDateTime(p.date) ?? ""),
      value: p.value,
    }))
    .filter(
      (p): p is { at: number; value: number } =>
        Number.isFinite(p.at) && isFiniteNumber(p.value),
    )
    .sort((a, b) => a.at - b.at);
  if (points.length < 2) return null;
  return points.map((p, i) => {
    const next = points[i + 1];
    const prev = points[i - 1]!;
    const span = next
      ? Math.min(5, (next.at - p.at) / 60000)
      : Math.min(1, (p.at - prev.at) / 60000);
    return { ...p, span };
  });
}

/** Rounded watts, or null when absent or above 2000 W (a sensor glitch). */
function plausibleWatts(value: number | null) {
  return value == null || value > 2000 ? null : Math.round(value);
}

function minutesInBand(points: TimedPoint[], [low, high]: [number, number]) {
  return points.reduce(
    (sum, p) => (p.value >= low && p.value <= high ? sum + p.span : sum),
    0,
  );
}

/**
 * Average watts and minutes inside the Zone 2 power band from the workout's
 * power samples. Zero-watt samples count, as they do in Peloton's average.
 */
export function powerSummary(
  data: HaeWorkout["cyclingPower"],
  band: [number, number] | null,
): {
  avgWatts: number;
  zone2Minutes: number | null;
  best5MinWatts: number | null;
  best20MinWatts: number | null;
} | null {
  const points = timedPoints(
    (data ?? [])
      .filter((p) => !p.units || /^w(atts?)?$/i.test(p.units))
      .map((p) => ({ date: p.date, value: p.qty })),
  );
  if (!points) return null;
  const minutes = points.reduce((sum, p) => sum + p.span, 0);
  if (minutes <= 0) return null;
  const avgWatts =
    points.reduce((sum, p) => sum + p.value * p.span, 0) / minutes;
  if (avgWatts <= 0 || avgWatts > 2000) return null;
  return {
    avgWatts: Math.round(avgWatts),
    zone2Minutes: band ? Math.round(minutesInBand(points, band)) : null,
    best5MinWatts: plausibleWatts(bestRollingAverage(points, 5)),
    best20MinWatts: plausibleWatts(bestRollingAverage(points, 20)),
  };
}

const WATCH_SOURCE = /watch/i;

/**
 * Heart rate from one source. A chest strap paired to the Peloton reaches
 * Apple Health through Peloton, so when any non-Watch readings exist the
 * Watch's optical readings are dropped rather than blended with them.
 */
export function preferredHeartRate(
  data: HaeWorkout["heartRateData"],
): HaeWorkout["heartRateData"] {
  const points = data ?? [];
  const other = points.filter((p) => p.source && !WATCH_SOURCE.test(p.source));
  return other.length >= 2 ? other : points;
}

function sourcesOf(data: { source?: string }[] | undefined): string[] {
  return [
    ...new Set((data ?? []).map((p) => p.source?.trim()).filter(Boolean)),
  ] as string[];
}

/**
 * Best average over any window of at least `minutes`, time-weighted. Null
 * when the series is shorter than the window.
 */
function bestRollingAverage(points: TimedPoint[], minutes: number) {
  let best: number | null = null;
  for (let i = 0; i < points.length; i += 1) {
    let span = 0;
    let sum = 0;
    for (let j = i; j < points.length && span < minutes; j += 1) {
      span += points[j]!.span;
      sum += points[j]!.value * points[j]!.span;
    }
    if (span < minutes * 0.95) break;
    const avg = sum / span;
    if (best == null || avg > best) best = avg;
  }
  return best;
}

const WARM_UP_MINUTES = 10;
const MIN_ZONE2_HR_MINUTES = 10;

/**
 * Median heart rate over the minutes spent in the Zone 2 power band, after a
 * 10 minute warm-up. Needs 10 such minutes. Falling over months at the same
 * watts is the aerobic fitness signal.
 */
export function zone2HeartRateFromPower(
  power: HaeWorkout["cyclingPower"],
  heartRate: HaeWorkout["heartRateData"],
  [low, high]: [number, number],
): number | null {
  const minuteOf = (date?: string) =>
    Math.floor(Date.parse(toIsoDateTime(date) ?? "") / 60000);
  const bpmByMinute = new Map<number, number[]>();
  for (const p of heartRate ?? []) {
    const minute = minuteOf(p.date);
    const bpm = p.Avg ?? p.qty;
    if (!Number.isFinite(minute) || !isFiniteNumber(bpm)) continue;
    bpmByMinute.set(minute, [...(bpmByMinute.get(minute) ?? []), bpm]);
  }
  const wattsByMinute = new Map<number, number[]>();
  for (const p of power ?? []) {
    const minute = minuteOf(p.date);
    if (!Number.isFinite(minute) || !isFiniteNumber(p.qty)) continue;
    wattsByMinute.set(minute, [...(wattsByMinute.get(minute) ?? []), p.qty]);
  }
  const minutes = [...wattsByMinute.keys()].sort((a, b) => a - b);
  if (minutes.length === 0) return null;
  const mean = (values: number[]) =>
    values.reduce((sum, v) => sum + v, 0) / values.length;
  const inBand: number[] = [];
  for (const minute of minutes) {
    if (minute < minutes[0]! + WARM_UP_MINUTES) continue;
    const watts = mean(wattsByMinute.get(minute)!);
    const bpm = bpmByMinute.get(minute);
    if (bpm && watts >= low && watts <= high) inBand.push(mean(bpm));
  }
  if (inBand.length < MIN_ZONE2_HR_MINUTES) return null;
  inBand.sort((a, b) => a - b);
  const mid = Math.floor(inBand.length / 2);
  const median =
    inBand.length % 2 === 0
      ? (inBand[mid - 1]! + inBand[mid]!) / 2
      : inBand[mid]!;
  const bpm = Math.round(median);
  return bpm >= 20 && bpm <= 250 ? bpm : null;
}

function mapWorkout(
  workout: HaeWorkout,
  options: HealthAutoExportOptions,
): AppleHealthWorkoutPayload | null {
  const name = workout.name?.trim();
  const start = toIsoDateTime(workout.start);
  if (!name || !start || !RIDE_PATTERN.test(name)) return null;
  const end = toIsoDateTime(workout.end) ?? undefined;
  const durationMinutes = isFiniteNumber(workout.duration)
    ? Math.min(1440, Math.round(workout.duration / 60))
    : undefined;
  const distance = quantity(workout.distance);
  const distanceUnits = workout.distance?.units as keyof typeof METERS;
  const power = powerSummary(workout.cyclingPower, options.zone2Watts ?? null);
  const heartRate = preferredHeartRate(workout.heartRateData);
  const heartRateZone2 = options.zone2Bpm
    ? zone2MinutesFromHeartRate(heartRate, options.zone2Bpm)
    : null;
  // Heart rate mode has no power fallback: the power band is stale then, and
  // a value from it would overwrite the stored heart rate value.
  const zone2 =
    options.zone2CreditBy === "heart_rate"
      ? heartRateZone2
      : (power?.zone2Minutes ?? heartRateZone2);
  const zone2HeartRate =
    power && options.zone2Watts
      ? zone2HeartRateFromPower(
          workout.cyclingPower,
          heartRate,
          options.zone2Watts,
        )
      : null;
  const heartRateSources = sourcesOf(workout.heartRateData);
  const powerSources = sourcesOf(workout.cyclingPower);

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
    ...(power ? { avg_power_watts: power.avgWatts } : {}),
    ...(power?.best5MinWatts != null
      ? { best_5min_watts: power.best5MinWatts }
      : {}),
    ...(power?.best20MinWatts != null
      ? { best_20min_watts: power.best20MinWatts }
      : {}),
    ...(zone2HeartRate != null ? { zone2_heart_rate: zone2HeartRate } : {}),
    ...(heartRateSources.length > 0
      ? { heart_rate_sources: heartRateSources }
      : {}),
    ...(powerSources.length > 0 ? { power_sources: powerSources } : {}),
    ...(zone2 != null
      ? {
          zone2_minutes:
            durationMinutes != null ? Math.min(zone2, durationMinutes) : zone2,
        }
      : {}),
  };
}

function rangeOf(workout: AppleHealthWorkoutPayload) {
  const start = Date.parse(workout.start);
  const end = workout.end
    ? Date.parse(workout.end)
    : start + (workout.duration_minutes ?? 0) * 60000;
  return { start, end };
}

/**
 * Keeps the stronger of two rides that overlap by more than half (power, then
 * heart rate, then length) and fills its missing fields from the other copy.
 */
export function dedupeOverlappingRides(
  workouts: AppleHealthWorkoutPayload[],
): AppleHealthWorkoutPayload[] {
  const kept: AppleHealthWorkoutPayload[] = [];
  const score = (w: AppleHealthWorkoutPayload) =>
    (w.avg_power_watts != null ? 2e9 : 0) +
    (w.avg_heart_rate != null ? 1e9 : 0) +
    (rangeOf(w).end - rangeOf(w).start);
  const merge = (
    winner: AppleHealthWorkoutPayload,
    other: AppleHealthWorkoutPayload,
  ): AppleHealthWorkoutPayload => ({
    ...winner,
    avg_heart_rate: winner.avg_heart_rate ?? other.avg_heart_rate,
    max_heart_rate: winner.max_heart_rate ?? other.max_heart_rate,
    distance_meters: winner.distance_meters ?? other.distance_meters,
    // Power-measured Zone 2 comes with the winner when it has power.
    zone2_minutes: winner.zone2_minutes ?? other.zone2_minutes,
    zone2_heart_rate: winner.zone2_heart_rate ?? other.zone2_heart_rate,
  });

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
    } else {
      const other = kept[clashIndex]!;
      kept[clashIndex] =
        score(workout) > score(other)
          ? merge(workout, other)
          : merge(other, workout);
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

/**
 * A ride copy with power but no heart rate series (Peloton) borrows the series
 * of an overlapping copy that has one (the Watch), so heart rate at Zone 2
 * power can be measured when the two apps split the data.
 */
function shareHeartRateAcrossCopies(workouts: HaeWorkout[]): HaeWorkout[] {
  const rangeOfRaw = (w: HaeWorkout) => ({
    start: Date.parse(toIsoDateTime(w.start) ?? ""),
    end: Date.parse(toIsoDateTime(w.end) ?? ""),
  });
  const rides = workouts.filter(
    (w) =>
      w.name &&
      RIDE_PATTERN.test(w.name) &&
      (w.heartRateData?.length ?? 0) >= 2,
  );
  return workouts.map((w) => {
    if (!w.cyclingPower?.length || (w.heartRateData?.length ?? 0) >= 2)
      return w;
    const a = rangeOfRaw(w);
    const donor = rides.find((other) => {
      const b = rangeOfRaw(other);
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      const shorter = Math.min(a.end - a.start, b.end - b.start);
      return other !== w && shorter > 0 && overlap > shorter / 2;
    });
    return donor ? { ...w, heartRateData: donor.heartRateData } : w;
  });
}

export function mapHealthAutoExport(
  body: HealthAutoExportBody,
  options: HealthAutoExportOptions = {},
): MappedHealthAutoExport {
  const { dailyMetrics, sleep, morningDaylight } = mapDailyAndSleep(
    body.data?.metrics ?? [],
  );
  const workouts = dedupeOverlappingRides(
    shareHeartRateAcrossCopies(body.data?.workouts ?? [])
      .map((w) => mapWorkout(w, options))
      .filter((w): w is AppleHealthWorkoutPayload => w != null),
  );
  const strengthWorkouts = (body.data?.workouts ?? [])
    .map(mapStrengthWorkout)
    .filter((w): w is WatchStrengthWorkout => w != null);
  return { dailyMetrics, sleep, morningDaylight, workouts, strengthWorkouts };
}
