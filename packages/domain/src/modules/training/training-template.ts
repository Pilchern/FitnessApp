import type { EntityId, IsoDateTime, UserId } from "../../shared/ids";
import type { CardioSessionKind } from "../cardio/cardio-session";

export type TrainingTemplateType = "strength" | "cardio";

export type CardioTrainingTemplateDefinition = {
  sessionKind: CardioSessionKind;
  targetDurationMinutes?: number | null;
  targetZone2Minutes?: number | null;
  workIntervalMinutes?: number | null;
  recoveryIntervalMinutes?: number | null;
  rounds?: number | null;
  equipment?: string | null;
  notes?: string | null;
};

export type StrengthTemplateExercise = {
  exerciseName: string;
  exerciseOrder: number;
  targetSets: number;
  targetReps: number | null;
  targetWeight: number | null;
  targetRir: number | null;
  notes: string | null;
};

export type StrengthTrainingTemplateDefinition = {
  exercises: StrengthTemplateExercise[];
  notes: string | null;
};

export type TrainingTemplate = {
  id: EntityId;
  userId: UserId;
  name: string;
  templateType: TrainingTemplateType;
  isArchived: boolean;
  definition: CardioTrainingTemplateDefinition | StrengthTrainingTemplateDefinition | Record<string, unknown>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};

export function isStrengthTemplateDefinition(
  def: TrainingTemplate["definition"],
): def is StrengthTrainingTemplateDefinition {
  return (
    typeof def === "object" &&
    def !== null &&
    "exercises" in def &&
    Array.isArray((def as StrengthTrainingTemplateDefinition).exercises)
  );
}
