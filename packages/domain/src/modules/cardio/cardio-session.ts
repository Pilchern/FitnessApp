import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";
import type { ManualOrImportedRecordSource } from "../../shared/source";

export type CardioSessionKind = "zone2" | "vo2" | "recovery" | "other";
export type CardioSessionCompletion =
  | "planned"
  | "completed"
  | "partial"
  | "skipped";

export type CardioSession = {
  id: EntityId;
  userId: UserId;
  trainingTemplateId: EntityId | null;
  sessionDate: IsoDate;
  startedAt: IsoDateTime | null;
  endedAt: IsoDateTime | null;
  sessionKind: CardioSessionKind;
  plannedVsCompleted: CardioSessionCompletion;
  durationMinutes: number | null;
  zone2Minutes: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgOutput: number | null;
  /** Best rolling 5 min average power, watts (VO2 trend proxy). */
  best5MinWatts: number | null;
  /** Best rolling 20 min average power, watts. */
  best20MinWatts: number | null;
  /** Median heart rate while in the Zone 2 power band, after warm-up. */
  zone2HeartRate: number | null;
  cadenceMin: number | null;
  cadenceMax: number | null;
  resistanceMin: number | null;
  resistanceMax: number | null;
  intervalStructure: string | null;
  rpe: number | null;
  distanceMeters: number | null;
  notes: string | null;
  sportType: string | null;
  source: ManualOrImportedRecordSource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
