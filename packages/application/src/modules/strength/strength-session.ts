import type {
  EntityId,
  StrengthSession,
  StrengthExerciseSet,
  UserId,
} from "@fitness-app/domain";
import { z } from "zod";
import {
  dateRangeQuerySchema,
  defaultManualSource,
  isoDateSchema,
  manualOrImportedRecordSourceSchema,
  optionalTrimmedStringSchema,
  trimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";

const strengthExerciseSetSchema = z.object({
  id: uuidSchema.optional(),
  exerciseName: trimmedStringSchema,
  exerciseOrder: z.number().int().min(0),
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0).nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
  rir: z.number().min(0).max(6).nullable().optional(),
  notes: optionalTrimmedStringSchema,
});

const strengthSessionBaseSchema = z.object({
  sessionDate: isoDateSchema,
  sessionName: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  durationMinutes: z.number().int().min(0).nullable().optional(),
  readinessPre: z.number().int().min(1).max(10).nullable().optional(),
  energyPost: z.number().int().min(1).max(10).nullable().optional(),
  completedAsPlanned: z.boolean().default(true),
  source: manualOrImportedRecordSourceSchema.default(defaultManualSource),
  sets: z.array(strengthExerciseSetSchema).min(1, "At least one set is required"),
});

export const createStrengthSessionSchema = strengthSessionBaseSchema.extend({
  userId: uuidSchema,
});

export const updateStrengthSessionSchema = strengthSessionBaseSchema.extend({
  id: uuidSchema,
  userId: uuidSchema,
});

export const strengthSessionDateRangeQuerySchema = dateRangeQuerySchema;

export type CreateStrengthSessionInput = z.infer<typeof createStrengthSessionSchema>;
export type UpdateStrengthSessionInput = z.infer<typeof updateStrengthSessionSchema>;
export type StrengthSessionDateRangeQuery = z.infer<
  typeof strengthSessionDateRangeQuerySchema
>;
export type StrengthExerciseSetInput = z.infer<typeof strengthExerciseSetSchema>;

export type StrengthSessionListItemDto = {
  id: EntityId;
  sessionDate: string;
  sessionName: string | null;
  completedAsPlanned: boolean;
  setCount: number;
  exerciseCount: number;
};

export interface StrengthSessionRepository {
  create(input: CreateStrengthSessionInput): Promise<StrengthSession>;
  update(input: UpdateStrengthSessionInput): Promise<StrengthSession>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<StrengthSession | null>;
  listByDateRange(query: StrengthSessionDateRangeQuery): Promise<StrengthSession[]>;
}

export class StrengthSessionService {
  constructor(private readonly repository: StrengthSessionRepository) {}

  async create(input: unknown) {
    return this.repository.create(createStrengthSessionSchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateStrengthSessionSchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async listByDateRange(input: unknown) {
    return this.repository.listByDateRange(
      strengthSessionDateRangeQuerySchema.parse(input),
    );
  }

  async listListItemsByDateRange(input: unknown): Promise<StrengthSessionListItemDto[]> {
    const sessions = await this.listByDateRange(input);
    return sessions.map((session) => {
      const exerciseNames = new Set(session.sets.map((set) => set.exerciseName));
      return {
        id: session.id,
        sessionDate: session.sessionDate,
        sessionName: session.sessionName,
        completedAsPlanned: session.completedAsPlanned,
        setCount: session.sets.length,
        exerciseCount: exerciseNames.size,
      };
    });
  }
}
