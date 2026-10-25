import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";

/**
 * Every number a DEXA report row carries, in the order the form shows them.
 * The column name is the snake_case of the key (`legsLeanLb` -> `legs_lean_lb`).
 */
export const DEXA_MEASUREMENT_KEYS = [
  "heightIn",
  "totalMassLb",
  "fatLb",
  "leanLb",
  "bmcLb",
  "bodyFatPct",
  "armsFatLb",
  "armsLeanLb",
  "armsBmcLb",
  "legsFatLb",
  "legsLeanLb",
  "legsBmcLb",
  "trunkFatLb",
  "trunkLeanLb",
  "trunkBmcLb",
  "androidFatLb",
  "androidLeanLb",
  "androidBmcLb",
  "gynoidFatLb",
  "gynoidLeanLb",
  "gynoidBmcLb",
  "rightArmLeanLb",
  "rightArmFatLb",
  "leftArmLeanLb",
  "leftArmFatLb",
  "rightLegLeanLb",
  "rightLegFatLb",
  "leftLegLeanLb",
  "leftLegFatLb",
  "vatLb",
  "vatIn3",
  "agRatio",
  "bmdTotal",
  "bmdTScore",
  "bmdZScore",
] as const;

export type DexaMeasurementKey = (typeof DEXA_MEASUREMENT_KEYS)[number];

export type DexaMeasurements = Record<DexaMeasurementKey, number | null>;

/** One DEXA scan, typed in from the report. Never mixed into body_metrics. */
export type DexaScan = DexaMeasurements & {
  id: EntityId;
  userId: UserId;
  scanDate: IsoDate;
  facility: string | null;
  machine: string | null;
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};
