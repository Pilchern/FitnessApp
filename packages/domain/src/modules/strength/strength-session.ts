import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";
import type { ManualOrImportedRecordSource } from "../../shared/source";

export type StrengthExerciseSet = {
  id: EntityId;
  userId: UserId;
  strengthSessionId: EntityId;
  exerciseName: string;
  exerciseOrder: number;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rir: number | null;
  isWarmup: boolean;
  durationSeconds: number | null;
  distanceMeters: number | null;
  /** Per-leg sets only; absent or null for bilateral and older sets. */
  side?: "left" | "right" | null;
  /** Isometric peak force, newtons. */
  peakForceNewtons?: number | null;
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};

export type StrengthSession = {
  id: EntityId;
  userId: UserId;
  trainingTemplateId: EntityId | null;
  /**
   * The program session this lift fulfils, when started from the program.
   * Absent or null for manual logging and older rows (matched by date).
   */
  programSessionId?: EntityId | null;
  sessionDate: IsoDate;
  sessionName: string | null;
  notes: string | null;
  durationMinutes: number | null;
  readinessPre: number | null;
  energyPost: number | null;
  completedAsPlanned: boolean;
  /** From a merged Apple Watch strength workout; absent or null otherwise. */
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  activeEnergyKcal?: number | null;
  source: ManualOrImportedRecordSource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  sets: StrengthExerciseSet[];
};
