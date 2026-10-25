import type { DexaDelta } from "@fitness-app/application";

export function formatNumber(value: number | null, dp = 1, unit = "") {
  if (value == null) return "–";
  const text = value.toFixed(dp);
  return unit ? `${text} ${unit}` : text;
}

/** "+1.7 lb, within noise" / "-2.5 lb" / "no data". */
export function formatDexaDelta(delta: DexaDelta) {
  if (delta.change == null) return "no data";
  const dp = delta.unit === "lb" && Math.abs(delta.change) < 1 ? 2 : 1;
  const sign = delta.change > 0 ? "+" : "";
  const value = `${sign}${delta.change.toFixed(dp)}${delta.unit ? ` ${delta.unit}` : ""}`;
  return delta.withinNoise ? `${value}, within noise` : value;
}

export function formatScanDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}
