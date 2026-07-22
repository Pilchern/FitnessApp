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

/** 0 = Sunday .. 6 = Saturday, matching JS `Date#getDay()`. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TrainingTemplate = {
  id: EntityId;
  userId: UserId;
  name: string;
  templateType: TrainingTemplateType;
  isArchived: boolean;
  definition: CardioTrainingTemplateDefinition | StrengthTrainingTemplateDefinition | Record<string, unknown>;
  /** Optional day this template is scheduled for (e.g. pin a strength template to Mon/Wed/Fri), so `/strength` can surface "today's plan" without the user re-picking it each session. */
  scheduledDayOfWeek: DayOfWeek | null;
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
