import type {
  AdjustedBodyFat,
  WeeklyWeightTrend,
} from "@fitness-app/application";
import type { BodyMetric } from "@fitness-app/domain";
import type { BodyFormValues } from "./types";

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numberToInput(value: number | null) {
  return value == null ? "" : `${value}`;
}

export function toBodyFormValues(metric: BodyMetric | null): BodyFormValues {
  if (!metric) {
    return {
      measuredOn: todayIsoDate(),
      waistIn: "",
      waistHipIn: "",
      waistGutIn: "",
      thighLIn: "",
      thighRIn: "",
      sourceType: "manual",
      notes: "",
    };
  }

  return {
    id: metric.id,
    measuredOn: metric.measuredOn,
    waistIn: numberToInput(metric.waistIn),
    waistHipIn: numberToInput(metric.waistHipIn),
    waistGutIn: numberToInput(metric.waistGutIn),
    thighLIn: numberToInput(metric.thighLIn ?? null),
    thighRIn: numberToInput(metric.thighRIn ?? null),
    sourceType: "manual",
    notes: metric.notes ?? "",
  };
}

export function formatBodyDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatBodyValue(
  value: number | null,
  unit: string,
  precision = 1,
) {
  if (value == null) {
    return "--";
  }

  return `${value.toFixed(precision)} ${unit}`;
}

export function formatChange(value: number | null, unit: string) {
  if (value == null) {
    return "No comparison yet";
  }

  const prefix = value > 0 ? "+" : "";
  const arrow = value > 0 ? " ↑" : value < 0 ? " ↓" : "";
  return `${prefix}${value.toFixed(1)} ${unit}${arrow} vs first logged`;
}

/** Same basis as the dashboard: 7-day average and its change vs last week. */
export function formatWeeklyWeightHint(trend: WeeklyWeightTrend) {
  if (trend.sevenDayAvgLb == null) {
    return "No weigh-ins this week";
  }

  const avg = `7-day avg ${trend.sevenDayAvgLb.toFixed(1)} lb`;
  if (trend.weekOverWeekLb == null) {
    return avg;
  }

  const prefix = trend.weekOverWeekLb > 0 ? "+" : "";
  return `${avg}, ${prefix}${trend.weekOverWeekLb.toFixed(1)} vs last week`;
}

export function formatSourceLabel(
  sourceType: BodyMetric["source"]["sourceType"],
) {
  return sourceType === "manual" ? "Manual" : "Imported";
}

/** "Estimate: Withings 7-day avg 21.2% + offset +1.6 (Oct 24, 2026 DEXA)". */
export function formatAdjustedHint(adjusted: AdjustedBodyFat) {
  const sign = adjusted.offsetPct >= 0 ? "+" : "";
  return `Estimate: Withings 7-day avg ${adjusted.withingsAvgPct.toFixed(1)}% ${sign}${adjusted.offsetPct.toFixed(1)} (${formatBodyDate(adjusted.offsetScanDate)} DEXA)`;
}
