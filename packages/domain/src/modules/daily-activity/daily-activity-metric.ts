import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";
import type { ManualOrImportedRecordSource } from "../../shared/source";

export type DailyActivityMetric = {
  id: EntityId;
  userId: UserId;
  metricDate: IsoDate;
  steps: number | null;
  vo2Max: number | null;
  restingHeartRate: number | null;
  exerciseMinutes: number | null;
  activeEnergyKcal: number | null;
  source: ManualOrImportedRecordSource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
