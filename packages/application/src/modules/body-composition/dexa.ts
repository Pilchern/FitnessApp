import {
  type DexaMeasurementKey,
  type DexaScan,
  type IsoDate,
  type UserId,
} from "@fitness-app/domain";
import { z } from "zod";
import { isoDateSchema, uuidSchema } from "../../shared/primitives";

/**
 * DEXA maths. Every derived number (ALMI, FFMI, limb LSI) is computed here
 * from the stored report values; none is stored.
 */

const LB_TO_KG = 0.45359237;
const IN_TO_M = 0.0254;

/** Lean or fat changes smaller than this between scans are measurement noise. */
export const DEXA_NOISE_LB = 2;

export type DexaFieldGroup =
  | "Scan"
  | "Total"
  | "Regions"
  | "Sides"
  | "VAT and bone";

export type DexaFieldSpec = {
  key: DexaMeasurementKey;
  label: string;
  unit: string;
  group: DexaFieldGroup;
  min: number;
  max: number;
};

function spec(
  key: DexaMeasurementKey,
  label: string,
  unit: string,
  group: DexaFieldGroup,
  min: number,
  max: number,
): DexaFieldSpec {
  return { key, label, unit, group, min, max };
}

/** Form order, labels and sanity limits (same limits as the table's checks). */
export const DEXA_FIELDS: DexaFieldSpec[] = [
  spec("heightIn", "Height", "in", "Scan", 48, 96),
  spec("totalMassLb", "Total mass", "lb", "Total", 50, 600),
  spec("fatLb", "Fat", "lb", "Total", 0, 400),
  spec("leanLb", "Lean", "lb", "Total", 0, 400),
  spec("bmcLb", "BMC", "lb", "Total", 0, 30),
  spec("bodyFatPct", "Body fat", "%", "Total", 0, 80),
  spec("armsFatLb", "Arms fat", "lb", "Regions", 0, 100),
  spec("armsLeanLb", "Arms lean", "lb", "Regions", 0, 100),
  spec("armsBmcLb", "Arms BMC", "lb", "Regions", 0, 10),
  spec("legsFatLb", "Legs fat", "lb", "Regions", 0, 200),
  spec("legsLeanLb", "Legs lean", "lb", "Regions", 0, 200),
  spec("legsBmcLb", "Legs BMC", "lb", "Regions", 0, 20),
  spec("trunkFatLb", "Trunk fat", "lb", "Regions", 0, 300),
  spec("trunkLeanLb", "Trunk lean", "lb", "Regions", 0, 300),
  spec("trunkBmcLb", "Trunk BMC", "lb", "Regions", 0, 20),
  spec("androidFatLb", "Android fat", "lb", "Regions", 0, 100),
  spec("androidLeanLb", "Android lean", "lb", "Regions", 0, 100),
  spec("androidBmcLb", "Android BMC", "lb", "Regions", 0, 10),
  spec("gynoidFatLb", "Gynoid fat", "lb", "Regions", 0, 100),
  spec("gynoidLeanLb", "Gynoid lean", "lb", "Regions", 0, 100),
  spec("gynoidBmcLb", "Gynoid BMC", "lb", "Regions", 0, 10),
  spec("rightArmLeanLb", "Right arm lean", "lb", "Sides", 0, 60),
  spec("rightArmFatLb", "Right arm fat", "lb", "Sides", 0, 60),
  spec("leftArmLeanLb", "Left arm lean", "lb", "Sides", 0, 60),
  spec("leftArmFatLb", "Left arm fat", "lb", "Sides", 0, 60),
  spec("rightLegLeanLb", "Right leg lean", "lb", "Sides", 0, 100),
  spec("rightLegFatLb", "Right leg fat", "lb", "Sides", 0, 100),
  spec("leftLegLeanLb", "Left leg lean", "lb", "Sides", 0, 100),
  spec("leftLegFatLb", "Left leg fat", "lb", "Sides", 0, 100),
  spec("vatLb", "VAT mass", "lb", "VAT and bone", 0, 20),
  spec("vatIn3", "VAT volume", "in³", "VAT and bone", 0, 20000),
  spec("agRatio", "A/G ratio", "", "VAT and bone", 0, 5),
  spec("bmdTotal", "BMD total", "g/cm²", "VAT and bone", 0, 3),
  spec("bmdTScore", "BMD T-score", "", "VAT and bone", -10, 10),
  spec("bmdZScore", "BMD Z-score", "", "VAT and bone", -10, 10),
];

const measurementShape = Object.fromEntries(
  DEXA_FIELDS.map((f) => [
    f.key,
    z
      .number()
      .min(f.min, `${f.label} must be at least ${f.min}`)
      .max(f.max, `${f.label} must be at most ${f.max}`)
      .nullable(),
  ]),
) as Record<DexaMeasurementKey, z.ZodNullable<z.ZodNumber>>;

export const saveDexaScanSchema = z.object({
  userId: uuidSchema,
  scanDate: isoDateSchema,
  facility: z.string().trim().max(120).nullable(),
  machine: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  ...measurementShape,
});

export type SaveDexaScanInput = z.infer<typeof saveDexaScanSchema>;

export interface DexaScanRepository {
  /** Insert, or replace the live scan on the same date. */
  save(input: SaveDexaScanInput): Promise<DexaScan>;
  /** Live scans, oldest first. */
  list(userId: UserId): Promise<DexaScan[]>;
}

export class DexaScanService {
  constructor(private readonly repository: DexaScanRepository) {}

  async save(input: unknown) {
    return this.repository.save(saveDexaScanSchema.parse(input));
  }

  async list(userId: UserId) {
    return this.repository.list(userId);
  }
}

function round(value: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function heightMeters(
  scan: Pick<DexaScan, "heightIn">,
  profileHeightCm: number | null,
) {
  if (scan.heightIn != null && scan.heightIn > 0)
    return scan.heightIn * IN_TO_M;
  if (profileHeightCm != null && profileHeightCm > 0)
    return profileHeightCm / 100;
  return null;
}

/** Appendicular lean mass index: (arms lean + legs lean, kg) / height m². */
export function almi(
  scan: Pick<DexaScan, "heightIn" | "armsLeanLb" | "legsLeanLb">,
  profileHeightCm: number | null = null,
) {
  const h = heightMeters(scan, profileHeightCm);
  if (h == null || scan.armsLeanLb == null || scan.legsLeanLb == null)
    return null;
  return round(((scan.armsLeanLb + scan.legsLeanLb) * LB_TO_KG) / (h * h), 2);
}

/** Fat-free mass index: (lean + BMC, kg) / height m². */
export function ffmi(
  scan: Pick<DexaScan, "heightIn" | "leanLb" | "bmcLb">,
  profileHeightCm: number | null = null,
) {
  const h = heightMeters(scan, profileHeightCm);
  if (h == null || scan.leanLb == null || scan.bmcLb == null) return null;
  return round(((scan.leanLb + scan.bmcLb) * LB_TO_KG) / (h * h), 1);
}

/** Limb symmetry: left / right x 100, one decimal. Left is the operated side. */
export function limbLsi(left: number | null, right: number | null) {
  return left != null && right != null && left > 0 && right > 0
    ? round((left / right) * 100, 1)
    : null;
}

export type DexaDerived = {
  almi: number | null;
  ffmi: number | null;
  legLeanLsi: number | null;
  armLeanLsi: number | null;
};

export function dexaDerived(
  scan: DexaScan,
  profileHeightCm: number | null = null,
): DexaDerived {
  return {
    almi: almi(scan, profileHeightCm),
    ffmi: ffmi(scan, profileHeightCm),
    legLeanLsi: limbLsi(scan.leftLegLeanLb, scan.rightLegLeanLb),
    armLeanLsi: limbLsi(scan.leftArmLeanLb, scan.rightArmLeanLb),
  };
}

export type DexaDelta = {
  label: string;
  unit: string;
  change: number | null;
  /** True when |change| is under DEXA_NOISE_LB (lean and fat rows only). */
  withinNoise: boolean;
};

const DELTA_ROWS: { key: DexaMeasurementKey; label: string; noise: boolean }[] =
  [
    { key: "totalMassLb", label: "Total mass", noise: false },
    { key: "leanLb", label: "Lean", noise: true },
    { key: "fatLb", label: "Fat", noise: true },
    { key: "bodyFatPct", label: "Body fat", noise: false },
    { key: "legsLeanLb", label: "Legs lean", noise: true },
    { key: "armsLeanLb", label: "Arms lean", noise: true },
    { key: "leftLegLeanLb", label: "Left leg lean", noise: true },
    { key: "rightLegLeanLb", label: "Right leg lean", noise: true },
    { key: "trunkFatLb", label: "Trunk fat", noise: true },
    { key: "vatLb", label: "VAT", noise: false },
  ];

/** Change from `from` to `to` for the headline rows; lean/fat under 2 lb is noise. */
export function dexaDeltas(from: DexaScan, to: DexaScan): DexaDelta[] {
  return DELTA_ROWS.map((row) => {
    const unit = DEXA_FIELDS.find((f) => f.key === row.key)?.unit ?? "";
    const a = from[row.key];
    const b = to[row.key];
    const change = a != null && b != null ? round(b - a, 2) : null;
    return {
      label: row.label,
      unit,
      change,
      withinNoise:
        row.noise && change != null && Math.abs(change) < DEXA_NOISE_LB,
    };
  });
}

export type DexaComparison = {
  latest: DexaScan;
  latestDerived: DexaDerived;
  previous: {
    scan: DexaScan;
    derived: DexaDerived;
    deltas: DexaDelta[];
  } | null;
  baseline: {
    scan: DexaScan;
    derived: DexaDerived;
    deltas: DexaDelta[];
  } | null;
};

/** Latest scan with its change vs the previous scan and vs the first (baseline). */
export function compareDexaScans(
  scans: DexaScan[],
  profileHeightCm: number | null = null,
): DexaComparison | null {
  const sorted = [...scans].sort((a, b) =>
    a.scanDate.localeCompare(b.scanDate),
  );
  const latest = sorted.at(-1);
  if (!latest) return null;
  const versus = (scan: DexaScan | undefined) =>
    scan && scan.id !== latest.id
      ? {
          scan,
          derived: dexaDerived(scan, profileHeightCm),
          deltas: dexaDeltas(scan, latest),
        }
      : null;
  const previous = versus(sorted.at(-2));
  const baseline = versus(sorted[0]);
  return {
    latest,
    latestDerived: dexaDerived(latest, profileHeightCm),
    previous,
    // With two scans the baseline is the previous one; show it once.
    baseline:
      baseline && previous && baseline.scan.id === previous.scan.id
        ? null
        : baseline,
  };
}

/** Newest scan on or before `date`. */
export function latestScanOnOrBefore(scans: DexaScan[], date: IsoDate) {
  return (
    [...scans]
      .filter((s) => s.scanDate <= date)
      .sort((a, b) => a.scanDate.localeCompare(b.scanDate))
      .at(-1) ?? null
  );
}
