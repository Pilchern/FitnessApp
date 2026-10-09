import type { BodyMetric } from "@fitness-app/domain";
import { buildSparseTrendSeries } from "../../shared/trend-series";

export type BodyMetricSummary = {
  latestWeightLb: number | null;
  weightChangeLb: number | null;
  latestWaistIn: number | null;
  waistChangeIn: number | null;
  latestBodyFatPct: number | null;
  latestMuscleMassLb: number | null;
  latestBoneMassLb: number | null;
  latestFatFreeMassLb: number | null;
  latestHydrationPct: number | null;
  latestVisceralFatIndex: number | null;
  latestSource: "manual" | "imported" | null;
};

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function findLatestValue(
  metrics: BodyMetric[],
  getValue: (metric: BodyMetric) => number | null,
) {
  return [...metrics]
    .sort((left, right) => right.measuredOn.localeCompare(left.measuredOn))
    .find((metric) => getValue(metric) != null);
}

function findEarliestValue(
  metrics: BodyMetric[],
  getValue: (metric: BodyMetric) => number | null,
) {
  return [...metrics]
    .sort((left, right) => left.measuredOn.localeCompare(right.measuredOn))
    .find((metric) => getValue(metric) != null);
}

export function buildBodyMetricSummary(
  metrics: BodyMetric[],
): BodyMetricSummary {
  const latest =
    [...metrics].sort((left, right) =>
      right.measuredOn.localeCompare(left.measuredOn),
    )[0] ?? null;
  const latestWeight = findLatestValue(metrics, (metric) => metric.weightLb);
  const earliestWeight = findEarliestValue(
    metrics,
    (metric) => metric.weightLb,
  );
  const latestWaist = findLatestValue(metrics, (metric) => metric.waistIn);
  const earliestWaist = findEarliestValue(metrics, (metric) => metric.waistIn);
  const latestBodyFat = findLatestValue(metrics, (metric) => metric.bodyFatPct);
  const latestMuscleMass = findLatestValue(
    metrics,
    (metric) => metric.muscleMassLb,
  );
  const latestBoneMass = findLatestValue(
    metrics,
    (metric) => metric.boneMassLb,
  );
  const latestFatFreeMass = findLatestValue(
    metrics,
    (metric) => metric.fatFreeMassLb,
  );
  const latestHydration = findLatestValue(
    metrics,
    (metric) => metric.hydrationPct,
  );
  const latestVisceralFat = findLatestValue(
    metrics,
    (metric) => metric.visceralFatIndex,
  );

  return {
    latestWeightLb: latestWeight?.weightLb ?? null,
    weightChangeLb:
      earliestWeight?.weightLb != null && latestWeight?.weightLb != null
        ? roundOneDecimal(latestWeight.weightLb - earliestWeight.weightLb)
        : null,
    latestWaistIn: latestWaist?.waistIn ?? null,
    waistChangeIn:
      earliestWaist?.waistIn != null && latestWaist?.waistIn != null
        ? roundOneDecimal(latestWaist.waistIn - earliestWaist.waistIn)
        : null,
    latestBodyFatPct: latestBodyFat?.bodyFatPct ?? null,
    latestMuscleMassLb: latestMuscleMass?.muscleMassLb ?? null,
    latestBoneMassLb: latestBoneMass?.boneMassLb ?? null,
    latestFatFreeMassLb: latestFatFreeMass?.fatFreeMassLb ?? null,
    latestHydrationPct: latestHydration?.hydrationPct ?? null,
    latestVisceralFatIndex: latestVisceralFat?.visceralFatIndex ?? null,
    latestSource: latest?.source.sourceType ?? null,
  };
}

export function buildBodyWeightTrend(metrics: BodyMetric[]) {
  return buildSparseTrendSeries(
    metrics,
    (metric) => metric.measuredOn,
    (metric) => metric.weightLb,
  );
}

export function buildBodyWaistTrend(metrics: BodyMetric[]) {
  return buildSparseTrendSeries(
    metrics,
    (metric) => metric.measuredOn,
    (metric) => metric.waistIn,
  );
}

export function buildBodyFatTrend(metrics: BodyMetric[]) {
  return buildSparseTrendSeries(
    metrics,
    (metric) => metric.measuredOn,
    (metric) => metric.bodyFatPct,
  );
}

/** Plan doc, nutrition: flag when the 7-day average climbs faster than this two weeks running. */
export const SURPLUS_THROTTLE_LB_PER_WEEK = 0.5;

export type WeeklyWeightTrend = {
  /** Mean of weigh-ins in the 7 days ending today. */
  sevenDayAvgLb: number | null;
  /** This 7-day average minus the previous 7 days' average. */
  weekOverWeekLb: number | null;
  /** Up more than SURPLUS_THROTTLE_LB_PER_WEEK in each of the last two weeks. */
  surplusThrottle: boolean;
};

function shiftIsoDate(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/**
 * Rolling 7-day weight averages for the rehab-phase surplus: the 7-day
 * average is the number that matters, and two consecutive weeks of gaining
 * more than 0.5 lb/week trips the throttle flag (the fix is trimming the
 * surplus, never protein). Windows are calendar days in the user's timezone,
 * so pass the zoned `today`.
 */
export function buildWeeklyWeightTrend(
  metrics: Pick<BodyMetric, "measuredOn" | "weightLb">[],
  today: string,
): WeeklyWeightTrend {
  const windowAverage = (weeksBack: number) => {
    const end = shiftIsoDate(today, -7 * weeksBack);
    const start = shiftIsoDate(end, -6);
    const values = metrics
      .filter(
        (m) =>
          m.weightLb != null && m.measuredOn >= start && m.measuredOn <= end,
      )
      .map((m) => m.weightLb as number);
    return values.length > 0
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : null;
  };

  const [thisWeek, lastWeek, twoWeeksAgo] = [0, 1, 2].map(windowAverage);
  const delta = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b != null ? a - b : null;
  const recent = delta(thisWeek, lastWeek);
  const prior = delta(lastWeek, twoWeeksAgo);

  return {
    sevenDayAvgLb: thisWeek != null ? roundOneDecimal(thisWeek) : null,
    weekOverWeekLb: recent != null ? roundOneDecimal(recent) : null,
    surplusThrottle:
      recent != null &&
      prior != null &&
      recent > SURPLUS_THROTTLE_LB_PER_WEEK &&
      prior > SURPLUS_THROTTLE_LB_PER_WEEK,
  };
}
