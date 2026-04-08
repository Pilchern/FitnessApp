import type {
  CardioSession,
  CardioSessionCompletion,
  CardioSessionKind,
  EntityId,
  UserId,
} from "@fitness-app/domain";
import { z } from "zod";
import {
  dateRangeQuerySchema,
  defaultManualSource,
  ensureAtLeastOneDefined,
  isoDateSchema,
  isoDateTimeSchema,
  manualOrImportedRecordSourceSchema,
  optionalTrimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";

const cardioSessionKindSchema = z.enum(["zone2", "vo2", "recovery", "other"]);
const cardioSessionCompletionSchema = z.enum([
  "planned",
  "completed",
  "partial",
  "skipped",
]);

const cardioSessionFields = {
  trainingTemplateId: uuidSchema.nullable().optional(),
  sessionDate: isoDateSchema,
  startedAt: isoDateTimeSchema.nullable().optional(),
  endedAt: isoDateTimeSchema.nullable().optional(),
  sessionKind: cardioSessionKindSchema,
  plannedVsCompleted: cardioSessionCompletionSchema.default("completed"),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  zone2Minutes: z.number().int().min(0).nullable().optional(),
  avgHeartRate: z.number().int().min(0).nullable().optional(),
  maxHeartRate: z.number().int().min(0).nullable().optional(),
  avgOutput: z.number().nonnegative().nullable().optional(),
  cadenceMin: z.number().int().min(0).nullable().optional(),
  cadenceMax: z.number().int().min(0).nullable().optional(),
  resistanceMin: z.number().nonnegative().nullable().optional(),
  resistanceMax: z.number().nonnegative().nullable().optional(),
  intervalStructure: optionalTrimmedStringSchema,
  rpe: z.number().min(1).max(10).nullable().optional(),
  distanceMeters: z.number().nonnegative().nullable().optional(),
  notes: optionalTrimmedStringSchema,
  source: manualOrImportedRecordSourceSchema.default(defaultManualSource),
} satisfies z.ZodRawShape;

function withCardioSessionRules<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (value: z.infer<T>) =>
        !value.startedAt ||
        !value.endedAt ||
        new Date(value.startedAt).getTime() <= new Date(value.endedAt).getTime(),
      {
        message: "endedAt must be after startedAt",
        path: ["endedAt"],
      },
    )
    .refine(
      (value: z.infer<T>) =>
        value.durationMinutes == null ||
        value.zone2Minutes == null ||
        value.zone2Minutes <= value.durationMinutes,
      {
        message: "zone2Minutes cannot exceed durationMinutes",
        path: ["zone2Minutes"],
      },
    )
    .refine(
      (value: z.infer<T>) =>
        value.cadenceMin == null ||
        value.cadenceMax == null ||
        value.cadenceMin <= value.cadenceMax,
      {
        message: "cadenceMin cannot exceed cadenceMax",
        path: ["cadenceMax"],
      },
    )
    .refine(
      (value: z.infer<T>) =>
        value.resistanceMin == null ||
        value.resistanceMax == null ||
        value.resistanceMin <= value.resistanceMax,
      {
        message: "resistanceMin cannot exceed resistanceMax",
        path: ["resistanceMax"],
      },
    );
}

export const createCardioSessionSchema = withCardioSessionRules(
  z.object({
    userId: uuidSchema,
    ...cardioSessionFields,
    sportType: z.string().nullable().optional(),
  }),
);

export const updateCardioSessionSchema = withCardioSessionRules(
  z
    .object({
      id: uuidSchema,
      userId: uuidSchema,
      trainingTemplateId: uuidSchema.nullable().optional(),
      sessionDate: isoDateSchema.optional(),
      startedAt: isoDateTimeSchema.nullable().optional(),
      endedAt: isoDateTimeSchema.nullable().optional(),
      sessionKind: cardioSessionKindSchema.optional(),
      plannedVsCompleted: cardioSessionCompletionSchema.optional(),
      durationMinutes: z.number().int().min(0).nullable().optional(),
      zone2Minutes: z.number().int().min(0).nullable().optional(),
      avgHeartRate: z.number().int().min(0).nullable().optional(),
      maxHeartRate: z.number().int().min(0).nullable().optional(),
      avgOutput: z.number().nonnegative().nullable().optional(),
      cadenceMin: z.number().int().min(0).nullable().optional(),
      cadenceMax: z.number().int().min(0).nullable().optional(),
      resistanceMin: z.number().nonnegative().nullable().optional(),
      resistanceMax: z.number().nonnegative().nullable().optional(),
      intervalStructure: optionalTrimmedStringSchema,
      rpe: z.number().min(1).max(10).nullable().optional(),
      distanceMeters: z.number().nonnegative().nullable().optional(),
      notes: optionalTrimmedStringSchema,
      source: manualOrImportedRecordSourceSchema.optional(),
    })
    .refine(
      (value) =>
        ensureAtLeastOneDefined(value, [
          "trainingTemplateId",
          "sessionDate",
          "startedAt",
          "endedAt",
          "sessionKind",
          "plannedVsCompleted",
          "durationMinutes",
          "zone2Minutes",
          "avgHeartRate",
          "maxHeartRate",
          "avgOutput",
          "cadenceMin",
          "cadenceMax",
          "resistanceMin",
          "resistanceMax",
          "intervalStructure",
          "rpe",
          "distanceMeters",
          "notes",
          "source",
        ]),
      {
        message: "At least one field must be provided for update",
      },
    ),
);

export const cardioSessionDateRangeQuerySchema = dateRangeQuerySchema;

export type CreateCardioSessionInput = z.infer<typeof createCardioSessionSchema>;
export type UpdateCardioSessionInput = z.infer<typeof updateCardioSessionSchema>;
export type CardioSessionDateRangeQuery = z.infer<
  typeof cardioSessionDateRangeQuerySchema
>;

export type CardioSessionListItemDto = {
  id: EntityId;
  sessionDate: string;
  sessionKind: CardioSessionKind;
  plannedVsCompleted: CardioSessionCompletion;
  durationMinutes: number | null;
  avgHeartRate: number | null;
  notes: string | null;
};

export interface CardioSessionRepository {
  create(input: CreateCardioSessionInput): Promise<CardioSession>;
  update(input: UpdateCardioSessionInput): Promise<CardioSession>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<CardioSession | null>;
  findByExternalId(
    userId: UserId,
    sourceProvider: string,
    sourceExternalId: string,
  ): Promise<CardioSession | null>;
  listByDateRange(query: CardioSessionDateRangeQuery): Promise<CardioSession[]>;
}

export class CardioSessionService {
  constructor(private readonly repository: CardioSessionRepository) {}

  async create(input: unknown) {
    return this.repository.create(createCardioSessionSchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateCardioSessionSchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async listByDateRange(input: unknown) {
    return this.repository.listByDateRange(
      cardioSessionDateRangeQuerySchema.parse(input),
    );
  }

  /**
   * Inserts an imported cardio session only if a row with the same
   * (userId, sourceProvider, sourceExternalId) does not already exist.
   * Returns the existing row if found, or the newly created one.
   */
  async upsertImported(
    userId: string,
    session: Omit<CreateCardioSessionInput, "userId">,
  ): Promise<{ created: boolean; session: CardioSession }> {
    const source = session.source as { sourceProvider?: string; sourceExternalId?: string } | undefined;
    const sourceProvider = source?.sourceProvider ?? null;
    const sourceExternalId = source?.sourceExternalId ?? null;

    if (sourceProvider && sourceExternalId) {
      const existing = await this.repository.findByExternalId(
        userId,
        sourceProvider,
        sourceExternalId,
      );
      if (existing) {
        return { created: false, session: existing };
      }
    }

    const created = await this.repository.create(
      createCardioSessionSchema.parse({ userId, ...session }),
    );
    return { created: true, session: created };
  }

  async listListItemsByDateRange(input: unknown): Promise<CardioSessionListItemDto[]> {
    const sessions = await this.listByDateRange(input);

    return sessions.map((session) => ({
      id: session.id,
      sessionDate: session.sessionDate,
      sessionKind: session.sessionKind,
      plannedVsCompleted: session.plannedVsCompleted,
      durationMinutes: session.durationMinutes,
      avgHeartRate: session.avgHeartRate,
      notes: session.notes,
    }));
  }
}
