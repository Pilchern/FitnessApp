import type {
  BodyScanReading,
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

const KG_TO_LB = 2.2046226218;

/**
 * Maps the form's DEXA inputs onto body_metrics columns. `leanMassLb` is the
 * report's Lean + BMC (fat-free mass, bone included) and goes to fat-free
 * mass in both units (the Withings import fills both too); kg is rounded to
 * 2 decimals like the import. Weight is never part of it.
 */
export function toBodyScanFields(input: {
  bodyFatPct: number | null;
  leanMassLb: number | null;
}) {
  return {
    bodyFatPct: input.bodyFatPct,
    fatFreeMassLb: input.leanMassLb,
    fatFreeMassKg:
      input.leanMassLb == null
        ? null
        : Number((input.leanMassLb / KG_TO_LB).toFixed(2)),
  };
}

/**
 * The DEXA inputs are only for hand-entered rows. Editing a Withings row must
 * not show (or resubmit) the scale's own body fat and fat-free mass.
 */
export function canEditBodyScan(metric: BodyMetric | null) {
  return metric == null || metric.source.sourceType === "manual";
}

/**
 * Server-side guard for an update that carries DEXA fields: only an existing
 * manual row may take them, so a hand-built POST cannot overwrite a Withings
 * row's body fat or fat-free mass. Returns the error to show, or null.
 */
export function bodyScanUpdateError(existing: BodyMetric | null) {
  if (!existing) {
    return "The body metric entry you tried to edit could not be found.";
  }
  return canEditBodyScan(existing)
    ? null
    : "DEXA results can only be saved on a manual entry, not a Withings reading.";
}

export function toBodyFormValues(metric: BodyMetric | null): BodyFormValues {
  if (!metric) {
    return {
      measuredOn: todayIsoDate(),
      waistIn: "",
      waistHipIn: "",
      waistGutIn: "",
      bodyFatPct: "",
      leanMassLb: "",
      sourceType: "manual",
      notes: "",
    };
  }

  const scanEditable = canEditBodyScan(metric);
  return {
    id: metric.id,
    measuredOn: metric.measuredOn,
    waistIn: numberToInput(metric.waistIn),
    waistHipIn: numberToInput(metric.waistHipIn),
    waistGutIn: numberToInput(metric.waistGutIn),
    bodyFatPct: scanEditable ? numberToInput(metric.bodyFatPct) : "",
    leanMassLb: scanEditable ? numberToInput(metric.fatFreeMassLb) : "",
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

/** Scan date, plus fat-free mass when the scan entry has it. */
export function formatBodyScanHint(scan: BodyScanReading) {
  const date = formatBodyDate(scan.measuredOn);
  return scan.fatFreeMassLb == null
    ? date
    : `${date} · fat-free ${formatBodyValue(scan.fatFreeMassLb, "lb")}`;
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
