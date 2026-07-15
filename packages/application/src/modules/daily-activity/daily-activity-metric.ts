import type { DailyActivityMetric, EntityId, UserId } from "@fitness-app/domain";
import { z } from "zod";
import {
  dateRangeQuerySchema,
  defaultManualSource,
  ensureAtLeastOneDefined,
  isoDateSchema,
  manualOrImportedRecordSourceSchema,
  uuidSchema,
} from "../../shared/primitives";

const dailyActivityMetricBaseSchema = z.object({
  metricDate: isoDateSchema,
  steps: z.number().int().nonnegative().nullable().optional(),
  vo2Max: z.number().positive().nullable().optional(),
  restingHeartRate: z.number().positive().nullable().optional(),
  exerciseMinutes: z.number().int().nonnegative().nullable().optional(),
  activeEnergyKcal: z.number().nonnegative().nullable().optional(),
  source: manualOrImportedRecordSourceSchema.default(defaultManualSource),
});

export const createDailyActivityMetricSchema = dailyActivityMetricBaseSchema.extend({
  userId: uuidSchema,
});

export const updateDailyActivityMetricSchema = dailyActivityMetricBaseSchema
  .partial()
  .extend({
    id: uuidSchema,
    userId: uuidSchema,
  })
  .refine(
    (value) =>
      ensureAtLeastOneDefined(value, [
        "metricDate",
        "steps",
        "vo2Max",
        "restingHeartRate",
        "exerciseMinutes",
        "activeEnergyKcal",
        "source",
      ]),
    {
      message: "At least one field must be provided for update",
    },
  );

export const dailyActivityMetricDateRangeQuerySchema = dateRangeQuerySchema;

export type CreateDailyActivityMetricInput = z.infer<
  typeof createDailyActivityMetricSchema
>;
export type UpdateDailyActivityMetricInput = z.infer<
  typeof updateDailyActivityMetricSchema
>;
export type DailyActivityMetricDateRangeQuery = z.infer<
  typeof dailyActivityMetricDateRangeQuerySchema
>;

export interface DailyActivityMetricRepository {
  create(input: CreateDailyActivityMetricInput): Promise<DailyActivityMetric>;
  update(input: UpdateDailyActivityMetricInput): Promise<DailyActivityMetric>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<DailyActivityMetric | null>;
  findByDate(userId: UserId, metricDate: string): Promise<DailyActivityMetric | null>;
  listByDateRange(
    query: DailyActivityMetricDateRangeQuery,
  ): Promise<DailyActivityMetric[]>;
}

export class DailyActivityMetricService {
  constructor(private readonly repository: DailyActivityMetricRepository) {}

  async create(input: unknown) {
    return this.repository.create(createDailyActivityMetricSchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateDailyActivityMetricSchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async getByDate(userId: string, metricDate: string) {
    return this.repository.findByDate(userId, metricDate);
  }

  async listByDateRange(input: unknown) {
    return this.repository.listByDateRange(
      dailyActivityMetricDateRangeQuerySchema.parse(input),
    );
  }
}
