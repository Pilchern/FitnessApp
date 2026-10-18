import type { RecoveryCheckin, UserId } from "@fitness-app/domain";
import type { RecoveryCheckinRepository } from "./recovery-checkin";

/**
 * Last night's heart rate, HRV, breathing rate and SpO2, averaged over the
 * time actually asleep.
 *
 * Health Auto Export sends these as hourly averages (and HRV sometimes as
 * single readings) from an automation separate from the one that sends sleep
 * times, and the two arrive in either order. The points are stored as they
 * come; each time either automation lands, the night is recomputed from
 * what is stored:
 * - Window: bedtime to wake from the night's check-in. Without both (sleep
 *   not synced yet, or no sleep recorded), 23:00-05:59, the old fixed
 *   window, and the row says which was used.
 * - Hourly averages count in proportion to the minutes of the hour inside
 *   the window, so a 00:15 bedtime counts 45 min of the midnight hour and
 *   none of 23:00. Single readings count when inside the window and win over
 *   hourly averages of the same metric (finer timing, same source).
 * - Awake time in the middle of the night stays in; the Watch's hourly
 *   averages cannot separate it.
 */

export type OvernightMetric =
  | "hrv"
  | "heart_rate"
  | "respiratory_rate"
  | "spo2";

export type OvernightSample = {
  metric: OvernightMetric;
  /** Phone wall-clock start, "YYYY-MM-DDTHH:MM:SS". */
  sampleLocal: string;
  /** 60 for an hourly average, 0 for a single reading. */
  bucketMinutes: 0 | 60;
  value: number;
};

export interface OvernightSampleRepository {
  upsertMany(userId: UserId, samples: OvernightSample[]): Promise<void>;
  /** Samples with sampleLocal in [fromLocal, toLocal). */
  listBetween(
    userId: UserId,
    fromLocal: string,
    toLocal: string,
  ): Promise<OvernightSample[]>;
}

export type OvernightWindow = {
  kind: "sleep" | "fixed";
  /** Wall-clock bounds, "YYYY-MM-DDTHH:MM:SS"; end exclusive. */
  start: string;
  end: string;
};

export type OvernightSummary = {
  sleepHrvAvg: number | null;
  sleepAvgHeartRate: number | null;
  sleepRespiratoryRate: number | null;
  sleepSpo2AvgPct: number | null;
};

/** Hourly coverage needed before a metric is reported for the night. */
const MIN_COVERED_MINUTES = 30;
/** A sleep window outside these bounds is a bad sync; use the fixed one. */
const MIN_SLEEP_SPAN_MIN = 120;
const MAX_SLEEP_SPAN_MIN = 16 * 60;
/** Bedtimes before noon belong to the wake date (after midnight). */
const NOON = "12:00";

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Wall-clock "YYYY-MM-DDTHH:MM[:SS]" as minutes, for differences only. */
function wallMinutes(local: string): number {
  const ms = Date.parse(`${local.length === 16 ? `${local}:00` : local}Z`);
  return ms / 60000;
}

function clock(value: string) {
  return value.slice(0, 5);
}

/** The wake date a sample belongs to: from 15:00 it rolls to the next day. */
export function overnightDateOf(sampleLocal: string): string {
  const date = sampleLocal.slice(0, 10);
  const hour = Number(sampleLocal.slice(11, 13));
  return hour >= 15 ? addDays(date, 1) : date;
}

/** Bedtime to wake when the check-in has a plausible night, else 23:00-06:00. */
export function overnightWindowFor(
  wakeDate: string,
  checkin: Pick<
    RecoveryCheckin,
    "bedtimeLocal" | "wakeTimeLocal" | "sleepDurationMinutes"
  > | null,
): OvernightWindow {
  const fixed: OvernightWindow = {
    kind: "fixed",
    start: `${addDays(wakeDate, -1)}T23:00:00`,
    end: `${wakeDate}T06:00:00`,
  };
  if (
    !checkin?.bedtimeLocal ||
    !checkin.wakeTimeLocal ||
    checkin.sleepDurationMinutes == null
  ) {
    return fixed;
  }
  const bed = clock(checkin.bedtimeLocal);
  const bedDate = bed >= NOON ? addDays(wakeDate, -1) : wakeDate;
  const start = `${bedDate}T${bed}:00`;
  const end = `${wakeDate}T${clock(checkin.wakeTimeLocal)}:00`;
  const span = wallMinutes(end) - wallMinutes(start);
  if (span < MIN_SLEEP_SPAN_MIN || span > MAX_SLEEP_SPAN_MIN) return fixed;
  return { kind: "sleep", start, end };
}

function metricMean(
  samples: OvernightSample[],
  metric: OvernightMetric,
  window: OvernightWindow,
): number | null {
  const start = wallMinutes(window.start);
  const end = wallMinutes(window.end);
  const own = samples.filter((s) => s.metric === metric);

  const readings = own.filter((s) => {
    if (s.bucketMinutes !== 0) return false;
    const at = wallMinutes(s.sampleLocal);
    return at >= start && at < end;
  });
  if (readings.length > 0) {
    return readings.reduce((sum, s) => sum + s.value, 0) / readings.length;
  }

  let weighted = 0;
  let minutes = 0;
  for (const s of own) {
    if (s.bucketMinutes === 0) continue;
    const from = wallMinutes(s.sampleLocal);
    const overlap =
      Math.min(from + s.bucketMinutes, end) - Math.max(from, start);
    if (overlap <= 0) continue;
    weighted += s.value * overlap;
    minutes += overlap;
  }
  return minutes >= MIN_COVERED_MINUTES ? weighted / minutes : null;
}

const round = (digits: number) => (v: number | null) =>
  v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits;

export function summarizeOvernight(
  samples: OvernightSample[],
  window: OvernightWindow,
): OvernightSummary {
  return {
    sleepHrvAvg: round(1)(metricMean(samples, "hrv", window)),
    sleepAvgHeartRate: round(0)(metricMean(samples, "heart_rate", window)),
    sleepRespiratoryRate: round(1)(
      metricMean(samples, "respiratory_rate", window),
    ),
    sleepSpo2AvgPct: round(1)(metricMean(samples, "spo2", window)),
  };
}

export class OvernightMetricsService {
  constructor(
    private readonly samples: OvernightSampleRepository,
    private readonly checkins: RecoveryCheckinRepository,
  ) {}

  /**
   * Stores new points, then recomputes every night they touch plus
   * `wakeDates` (nights whose sleep times just synced). Returns the number of
   * check-ins updated.
   */
  async sync(
    userId: UserId,
    samples: OvernightSample[],
    wakeDates: string[],
  ): Promise<number> {
    if (samples.length > 0) await this.samples.upsertMany(userId, samples);
    const nights = new Set([
      ...wakeDates,
      ...samples.map((s) => overnightDateOf(s.sampleLocal)),
    ]);
    let updated = 0;
    for (const night of [...nights].sort()) {
      if (await this.recompute(userId, night)) updated += 1;
    }
    return updated;
  }

  /** Rewrites one night's overnight vitals; false when nothing to write. */
  async recompute(userId: UserId, wakeDate: string): Promise<boolean> {
    // No check-in means no sleep synced yet; the sleep push recomputes.
    const checkin = await this.checkins.findByDate(userId, wakeDate);
    if (!checkin) return false;

    const window = overnightWindowFor(wakeDate, checkin);
    const samples = await this.samples.listBetween(
      userId,
      `${addDays(wakeDate, -1)}T12:00:00`,
      `${wakeDate}T14:00:00`,
    );
    const summary = summarizeOvernight(samples, window);
    if (Object.values(summary).every((v) => v == null)) return false;

    // Over the sleep window a metric with no coverage is cleared: what was
    // there came from the fixed window, which may be awake time. Over the
    // fixed window, gaps keep what the row already has.
    const keep = window.kind === "fixed";
    const pick = (value: number | null) =>
      value == null && keep ? undefined : value;
    await this.checkins.update({
      id: checkin.id,
      userId,
      sleepHrvAvg: pick(summary.sleepHrvAvg),
      sleepAvgHeartRate: pick(summary.sleepAvgHeartRate),
      sleepRespiratoryRate: pick(summary.sleepRespiratoryRate),
      sleepSpo2AvgPct: pick(summary.sleepSpo2AvgPct),
      overnightWindow: window.kind,
    });
    return true;
  }
}
