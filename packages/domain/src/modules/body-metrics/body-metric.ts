import type { IsoDate, IsoDateTime, UserId, EntityId } from "../../shared/ids";
import type { ManualOrImportedRecordSource } from "../../shared/source";

export type BodyMetric = {
  id: EntityId;
  userId: UserId;
  measuredOn: IsoDate;
  weightLb: number | null;
  weightKg: number | null;
  waistIn: number | null;
  waistCm: number | null;
  bodyFatPct: number | null;
  muscleMassLb: number | null;
  muscleMassKg: number | null;
  boneMassKg: number | null;
  boneMassLb: number | null;
  fatFreeMassKg: number | null;
  fatFreeMassLb: number | null;
  hydrationPct: number | null;
  visceralFatIndex: number | null;
  notes: string | null;
  source: ManualOrImportedRecordSource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
