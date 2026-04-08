import type {
  CardioTrainingTemplateDefinition,
  TrainingTemplate,
  UserId,
} from "@fitness-app/domain";
import { z } from "zod";
import { optionalTrimmedStringSchema, uuidSchema } from "../../shared/primitives";

export const cardioTrainingTemplateDefinitionSchema: z.ZodType<CardioTrainingTemplateDefinition> =
  z.object({
    sessionKind: z.enum(["zone2", "vo2", "recovery", "other"]),
    targetDurationMinutes: z.number().int().min(0).nullable().optional(),
    targetZone2Minutes: z.number().int().min(0).nullable().optional(),
    workIntervalMinutes: z.number().int().min(0).nullable().optional(),
    recoveryIntervalMinutes: z.number().int().min(0).nullable().optional(),
    rounds: z.number().int().min(0).nullable().optional(),
    equipment: optionalTrimmedStringSchema,
    notes: optionalTrimmedStringSchema,
  });

export const strengthTemplateExerciseSchema = z.object({
  exerciseName: z.string().trim().min(1),
  exerciseOrder: z.number().int().min(0),
  targetSets: z.number().int().min(1).max(20),
  targetReps: z.number().int().min(1).max(100).nullable(),
  targetWeight: z.number().min(0).nullable(),
  targetRir: z.number().int().min(0).max(6).nullable(),
  notes: z.string().nullable(),
});

export const strengthTrainingTemplateDefinitionSchema = z.object({
  exercises: strengthTemplateExerciseSchema.array().min(1),
  notes: z.string().nullable().optional(),
});

export type StrengthTrainingTemplateDefinition = z.infer<typeof strengthTrainingTemplateDefinitionSchema>;

export const createStrengthTemplateSchema = z.object({
  userId: uuidSchema,
  name: z.string().trim().min(1).max(100),
  definition: strengthTrainingTemplateDefinitionSchema,
});

export type CreateStrengthTemplateInput = z.infer<typeof createStrengthTemplateSchema>;

export const listActiveCardioTemplatesQuerySchema = z.object({
  userId: uuidSchema,
});

export type ListActiveCardioTemplatesQuery = z.infer<
  typeof listActiveCardioTemplatesQuerySchema
>;

export const listActiveStrengthTemplatesQuerySchema = z.object({
  userId: uuidSchema,
});

export type ListActiveStrengthTemplatesQuery = z.infer<
  typeof listActiveStrengthTemplatesQuerySchema
>;

export interface TrainingTemplateRepository {
  listActiveCardioTemplates(userId: UserId): Promise<TrainingTemplate[]>;
  listActiveStrengthTemplates(userId: UserId): Promise<TrainingTemplate[]>;
  createStrengthTemplate(input: CreateStrengthTemplateInput): Promise<TrainingTemplate>;
  archiveTemplate(userId: UserId, id: string): Promise<void>;
}

export class TrainingTemplateService {
  constructor(private readonly repository: TrainingTemplateRepository) {}

  async listActiveCardioTemplates(input: unknown) {
    const query = listActiveCardioTemplatesQuerySchema.parse(input);
    return this.repository.listActiveCardioTemplates(query.userId);
  }

  async listActiveStrengthTemplates(input: unknown) {
    const query = listActiveStrengthTemplatesQuerySchema.parse(input);
    return this.repository.listActiveStrengthTemplates(query.userId);
  }

  async createStrengthTemplate(input: unknown) {
    const validated = createStrengthTemplateSchema.parse(input);
    return this.repository.createStrengthTemplate(validated);
  }

  async archiveTemplate(userId: UserId, id: string) {
    return this.repository.archiveTemplate(userId, id);
  }
}
