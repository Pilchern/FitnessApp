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
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};

export type StrengthSession = {
  id: EntityId;
  userId: UserId;
  trainingTemplateId: EntityId | null;
  sessionDate: IsoDate;
  sessionName: string | null;
  notes: string | null;
  durationMinutes: number | null;
  readinessPre: number | null;
  energyPost: number | null;
  completedAsPlanned: boolean;
  source: ManualOrImportedRecordSource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  sets: StrengthExerciseSet[];
};
