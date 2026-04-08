import type { EntityId, RecoveryCheckin, UserId } from "@fitness-app/domain";
import { z } from "zod";
import {
  canonicalRecordSourceSchema,
  dateRangeQuerySchema,
  defaultManualSource,
  ensureAtLeastOneDefined,
  isoDateSchema,
  optionalTrimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";

const recoveryCheckinBaseSchema = z.object({
  checkinDate: isoDateSchema,
  restingHeartRate: z.number().int().min(0).nullable().optional(),
  hrv: z.number().nonnegative().nullable().optional(),
  sleepDurationMinutes: z.number().int().min(0).nullable().optional(),
  sleepQuality: z.number().int().min(1).max(5).nullable().optional(),
  energyLevel: z.number().int().min(1).max(10).nullable().optional(),
  readinessLevel: z.number().int().min(1).max(10).nullable().optional(),
  stressLevel: z.number().int().min(1).max(10).nullable().optional(),
  sorenessLevel: z.number().int().min(1).max(10).nullable().optional(),
  alcoholCount: z.number().int().min(0).default(0),
  notes: optionalTrimmedStringSchema,
  timeInBedMinutes: z.number().nullable().optional(),
  sleepEfficiencyPct: z.number().nullable().optional(),
  deepSleepMinutes: z.number().nullable().optional(),
  remSleepMinutes: z.number().nullable().optional(),
  coreSleepMinutes: z.number().nullable().optional(),
  awakeMinutes: z.number().nullable().optional(),
  sleepRespiratoryRate: z.number().nullable().optional(),
  sleepSpo2AvgPct: z.number().nullable().optional(),
  sleepHrvAvg: z.number().nullable().optional(),
  sleepAvgHeartRate: z.number().nullable().optional(),
  source: canonicalRecordSourceSchema.default(defaultManualSource),
});

export const createRecoveryCheckinSchema = recoveryCheckinBaseSchema.extend({
  userId: uuidSchema,
});

export const updateRecoveryCheckinSchema = recoveryCheckinBaseSchema
  .partial()
  .extend({
    id: uuidSchema,
    userId: uuidSchema,
  })
  .refine(
    (value) =>
      ensureAtLeastOneDefined(value, [
        "checkinDate",
        "restingHeartRate",
        "hrv",
        "sleepDurationMinutes",
        "sleepQuality",
        "energyLevel",
        "readinessLevel",
        "stressLevel",
        "sorenessLevel",
        "alcoholCount",
        "notes",
        "source",
      ]),
    {
      message: "At least one field must be provided for update",
    },
  );

export const recoveryCheckinDateRangeQuerySchema = dateRangeQuerySchema;

export type CreateRecoveryCheckinInput = z.infer<
  typeof createRecoveryCheckinSchema
>;
export type UpdateRecoveryCheckinInput = z.infer<
  typeof updateRecoveryCheckinSchema
>;
export type RecoveryCheckinDateRangeQuery = z.infer<
  typeof recoveryCheckinDateRangeQuerySchema
>;

export type RecoveryCheckinListItemDto = {
  id: EntityId;
  checkinDate: string;
  readinessLevel: number | null;
  stressLevel: number | null;
  sleepDurationMinutes: number | null;
};

export interface RecoveryCheckinRepository {
  create(input: CreateRecoveryCheckinInput): Promise<RecoveryCheckin>;
  update(input: UpdateRecoveryCheckinInput): Promise<RecoveryCheckin>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<RecoveryCheckin | null>;
  findByDate(userId: UserId, checkinDate: string): Promise<RecoveryCheckin | null>;
  listByDateRange(query: RecoveryCheckinDateRangeQuery): Promise<RecoveryCheckin[]>;
}

export class RecoveryCheckinService {
  constructor(private readonly repository: RecoveryCheckinRepository) {}

  async create(input: unknown) {
    return this.repository.create(createRecoveryCheckinSchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateRecoveryCheckinSchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async getByDate(userId: string, checkinDate: string) {
    return this.repository.findByDate(userId, checkinDate);
  }

  async listByDateRange(input: unknown) {
    return this.repository.listByDateRange(
      recoveryCheckinDateRangeQuerySchema.parse(input),
    );
  }

  async listListItemsByDateRange(
    input: unknown,
  ): Promise<RecoveryCheckinListItemDto[]> {
    const checkins = await this.listByDateRange(input);
    return checkins.map((checkin) => ({
      id: checkin.id,
      checkinDate: checkin.checkinDate,
      readinessLevel: checkin.readinessLevel,
      stressLevel: checkin.stressLevel,
      sleepDurationMinutes: checkin.sleepDurationMinutes,
    }));
  }
}
