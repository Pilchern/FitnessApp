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

export function buildBodyMetricSummary(metrics: BodyMetric[]): BodyMetricSummary {
  const latest = [...metrics].sort((left, right) =>
    right.measuredOn.localeCompare(left.measuredOn),
  )[0] ?? null;
  const latestWeight = findLatestValue(metrics, (metric) => metric.weightLb);
  const earliestWeight = findEarliestValue(metrics, (metric) => metric.weightLb);
  const latestWaist = findLatestValue(metrics, (metric) => metric.waistIn);
  const earliestWaist = findEarliestValue(metrics, (metric) => metric.waistIn);
  const latestBodyFat = findLatestValue(metrics, (metric) => metric.bodyFatPct);
  const latestMuscleMass = findLatestValue(
    metrics,
    (metric) => metric.muscleMassLb,
  );
  const latestBoneMass = findLatestValue(metrics, (metric) => metric.boneMassLb);
  const latestFatFreeMass = findLatestValue(
    metrics,
    (metric) => metric.fatFreeMassLb,
  );
  const latestHydration = findLatestValue(metrics, (metric) => metric.hydrationPct);
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
