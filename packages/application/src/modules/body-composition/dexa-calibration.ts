import type { BodyMetric, DexaScan, IsoDate } from "@fitness-app/domain";

/**
 * Withings (foot-to-foot BIA) vs DEXA. For each scan the offset is DEXA body
 * fat minus the Withings 7-day average ending on scan day. The estimate adds
 * the newest offset to the current Withings average. Raw Withings values are
 * never changed; the estimate is computed on read and labelled as one.
 */

export const CALIBRATION_WINDOW_DAYS = 7;

function shift(date: IsoDate, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function round(value: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

type ScaleRow = Pick<BodyMetric, "measuredOn" | "bodyFatPct" | "source">;

/** Mean scale body fat over the 7 days ending `end`; device rows only. */
export function withingsBodyFatAverage(
  metrics: ScaleRow[],
  end: IsoDate,
  days: number = CALIBRATION_WINDOW_DAYS,
): { avg: number; readings: number; start: IsoDate; end: IsoDate } | null {
  const start = shift(end, -(days - 1));
  const values = metrics
    .filter(
      (m) =>
        m.source.sourceType !== "manual" &&
        m.bodyFatPct != null &&
        m.measuredOn >= start &&
        m.measuredOn <= end,
    )
    .map((m) => m.bodyFatPct as number);
  if (values.length === 0) return null;
  return {
    avg: round(values.reduce((a, b) => a + b, 0) / values.length, 2),
    readings: values.length,
    start,
    end,
  };
}

export type DexaCalibration = {
  scanDate: IsoDate;
  dexaBodyFatPct: number;
  withingsAvgPct: number | null;
  withingsReadings: number;
  /** DEXA minus Withings, percentage points; null without scale readings. */
  offsetPct: number | null;
};

/** One row per scan with a body fat value, oldest first. */
export function dexaCalibrations(
  scans: Pick<DexaScan, "scanDate" | "bodyFatPct">[],
  metrics: ScaleRow[],
): DexaCalibration[] {
  return [...scans]
    .filter((s) => s.bodyFatPct != null)
    .sort((a, b) => a.scanDate.localeCompare(b.scanDate))
    .map((s) => {
      const w = withingsBodyFatAverage(metrics, s.scanDate);
      const dexa = s.bodyFatPct as number;
      return {
        scanDate: s.scanDate,
        dexaBodyFatPct: dexa,
        withingsAvgPct: w?.avg ?? null,
        withingsReadings: w?.readings ?? 0,
        offsetPct: w ? round(dexa - w.avg, 2) : null,
      };
    });
}

export type AdjustedBodyFat = {
  withingsAvgPct: number;
  withingsReadings: number;
  offsetPct: number;
  offsetScanDate: IsoDate;
  /** Withings 7-day average + the newest offset. An estimate, not a scan. */
  estimatePct: number;
};

/**
 * DEXA-adjusted estimate as of `today`, from the newest scan that has an
 * offset. Null without a calibrated scan or recent scale readings.
 */
export function dexaAdjustedBodyFat(
  calibrations: DexaCalibration[],
  metrics: ScaleRow[],
  today: IsoDate,
): AdjustedBodyFat | null {
  const latest = [...calibrations]
    .filter((c) => c.offsetPct != null && c.scanDate <= today)
    .at(-1);
  const current = withingsBodyFatAverage(metrics, today);
  if (!latest || latest.offsetPct == null || !current) return null;
  return {
    withingsAvgPct: current.avg,
    withingsReadings: current.readings,
    offsetPct: latest.offsetPct,
    offsetScanDate: latest.scanDate,
    estimatePct: round(current.avg + latest.offsetPct, 1),
  };
}
