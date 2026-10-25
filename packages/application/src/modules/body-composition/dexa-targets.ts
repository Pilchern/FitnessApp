import type { DexaScan, IsoDate } from "@fitness-app/domain";
import type { ProgramSettings } from "../program/program-settings";
import { dexaDerived } from "./dexa";

/**
 * Progress toward the body composition targets. "up" targets are floors to
 * reach (ALMI, LSI), "down" ones are ceilings (body fat, waist, VAT).
 */

export type TargetHorizon = { label: string; value: number; met: boolean };

export type TargetProgress = {
  key: "almi" | "leg_lean_lsi" | "dexa_bf" | "quad_lsi" | "waist" | "vat";
  label: string;
  unit: string;
  direction: "up" | "down";
  /** Where the line started: the first scan or reading. */
  baseline: number | null;
  current: number | null;
  currentDate: IsoDate | null;
  source: string;
  targets: TargetHorizon[];
  /** First target not yet met, or null when all are met (or no data). */
  next: TargetHorizon | null;
  /** 0-100: share of the way from baseline to `next`; null without a gap. */
  progressPct: number | null;
};

type Reading = { date: IsoDate; value: number } | null;

function met(direction: "up" | "down", current: number, target: number) {
  return direction === "up" ? current >= target : current <= target;
}

function build(input: {
  key: TargetProgress["key"];
  label: string;
  unit: string;
  direction: "up" | "down";
  baseline: number | null;
  current: Reading;
  source: string;
  targets: { label: string; value: number }[];
}): TargetProgress {
  const current = input.current?.value ?? null;
  const targets = input.targets.map((t) => ({
    ...t,
    met: current != null && met(input.direction, current, t.value),
  }));
  const next = current == null ? null : (targets.find((t) => !t.met) ?? null);
  let progressPct: number | null = null;
  if (next && current != null && input.baseline != null) {
    const span = next.value - input.baseline;
    if (span !== 0 && Math.sign(span) === (input.direction === "up" ? 1 : -1)) {
      const share = ((current - input.baseline) / span) * 100;
      progressPct = Math.round(Math.min(100, Math.max(0, share)));
    }
  }
  return {
    key: input.key,
    label: input.label,
    unit: input.unit,
    direction: input.direction,
    baseline: input.baseline,
    current,
    currentDate: input.current?.date ?? null,
    source: input.source,
    targets,
    next,
    progressPct,
  };
}

export function dexaTargetProgress(input: {
  /** Live scans, any order. */
  scans: DexaScan[];
  profileHeightCm: number | null;
  /** Quad strength LSI at 90°, first and latest reading (knee tests). */
  quadLsiFirst: Reading;
  quadLsiLatest: Reading;
  /** Waist at the navel, first and latest tape reading. */
  waistFirst: Reading;
  waistLatest: Reading;
  settings: ProgramSettings;
}): TargetProgress[] {
  const s = input.settings;
  const scans = [...input.scans].sort((a, b) =>
    a.scanDate.localeCompare(b.scanDate),
  );
  const first = scans[0] ?? null;
  const latest = scans.at(-1) ?? null;
  const d = (scan: DexaScan | null) =>
    scan ? dexaDerived(scan, input.profileHeightCm) : null;
  const firstD = d(first);
  const latestD = d(latest);
  const scanReading = (value: number | null | undefined): Reading =>
    latest && value != null ? { date: latest.scanDate, value } : null;

  return [
    build({
      key: "almi",
      label: "ALMI",
      unit: "kg/m²",
      direction: "up",
      baseline: firstD?.almi ?? null,
      current: scanReading(latestD?.almi),
      source: "DEXA",
      targets: [
        { label: "Jan 2027", value: s.almiTargetJan27 },
        { label: "Oct 2027", value: s.almiTargetOct27 },
        { label: "2029", value: s.almiTarget2029 },
      ],
    }),
    build({
      key: "leg_lean_lsi",
      label: "Leg lean LSI",
      unit: "%",
      direction: "up",
      baseline: firstD?.legLeanLsi ?? null,
      current: scanReading(latestD?.legLeanLsi),
      source: "DEXA",
      targets: [
        { label: "Jan 2027", value: s.legLeanLsiTargetJan27 },
        { label: "Oct 2027", value: s.legLeanLsiTargetOct27 },
      ],
    }),
    build({
      key: "dexa_bf",
      label: "DEXA body fat",
      unit: "%",
      direction: "down",
      baseline: first?.bodyFatPct ?? null,
      current: scanReading(latest?.bodyFatPct),
      source: "DEXA",
      targets: [
        { label: "Jan 2027", value: s.dexaBfTargetJan27 },
        { label: "Oct 2027", value: s.dexaBfTargetOct27 },
        { label: "2029", value: s.dexaBfTarget2029 },
      ],
    }),
    build({
      key: "quad_lsi",
      label: "Quad strength LSI",
      unit: "%",
      direction: "up",
      baseline: input.quadLsiFirst?.value ?? null,
      current: input.quadLsiLatest,
      source: "Crane test (90°)",
      targets: [{ label: "Oct 2027 (RTS gate)", value: s.lsiTarget3 }],
    }),
    build({
      key: "waist",
      label: "Waist at navel",
      unit: "in",
      direction: "down",
      baseline: input.waistFirst?.value ?? null,
      current: input.waistLatest,
      source: "Tape",
      targets: [{ label: "At or under", value: s.waistTargetIn }],
    }),
    build({
      key: "vat",
      label: "VAT",
      unit: "lb",
      direction: "down",
      baseline: first?.vatLb ?? null,
      current: scanReading(latest?.vatLb),
      source: "DEXA",
      targets: [{ label: "Hold under", value: s.vatMaxLb }],
    }),
  ];
}
