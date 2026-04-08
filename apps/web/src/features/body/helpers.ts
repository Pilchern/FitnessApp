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
      weightLb: "",
      waistIn: "",
      bodyFatPct: "",
      muscleMassLb: "",
      sourceType: "manual",
      notes: "",
    };
  }

  return {
    id: metric.id,
    measuredOn: metric.measuredOn,
    weightLb: numberToInput(metric.weightLb),
    waistIn: numberToInput(metric.waistIn),
    bodyFatPct: numberToInput(metric.bodyFatPct),
    muscleMassLb: numberToInput(metric.muscleMassLb),
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

export function formatSourceLabel(sourceType: BodyMetric["source"]["sourceType"]) {
  return sourceType === "manual" ? "Manual" : "Imported";
}
