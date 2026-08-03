import type { BodyMetric, EntityId, UserId } from "@fitness-app/domain";
import { z } from "zod";
import {
  dateRangeQuerySchema,
  defaultManualSource,
  ensureAtLeastOneDefined,
  isoDateSchema,
  manualOrImportedRecordSourceSchema,
  optionalTrimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";

// Upper bounds are data-entry/import sanity checks (well above any real human
// body measurement), not physiological limits. weightLb/weightKg matter most
// here: they feed NutritionTargetService's calorie/protein calculation
// directly, so a garbage value (a typo, or a unit-conversion bug in an
// imported payload) would silently corrupt someone's nutrition targets.
const bodyMetricBaseSchema = z.object({
  measuredOn: isoDateSchema,
  weightLb: z.number().positive().max(1000).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  waistIn: z.number().positive().max(120).nullable().optional(),
  waistCm: z.number().positive().max(300).nullable().optional(),
  waistHipIn: z.number().positive().max(120).nullable().optional(),
  waistGutIn: z.number().positive().max(120).nullable().optional(),
  bodyFatPct: z.number().min(0).max(100).nullable().optional(),
  muscleMassLb: z.number().nonnegative().max(1000).nullable().optional(),
  muscleMassKg: z.number().nonnegative().max(500).nullable().optional(),
  boneMassKg: z.number().nonnegative().max(500).nullable().optional(),
  boneMassLb: z.number().nonnegative().max(1000).nullable().optional(),
  fatFreeMassKg: z.number().nonnegative().max(500).nullable().optional(),
  fatFreeMassLb: z.number().nonnegative().max(1000).nullable().optional(),
  hydrationPct: z.number().min(0).max(100).nullable().optional(),
  visceralFatIndex: z
    .number()
    .int()
    .nonnegative()
    .max(60)
    .nullable()
    .optional(),
  notes: optionalTrimmedStringSchema,
  source: manualOrImportedRecordSourceSchema.default(defaultManualSource),
});

export const createBodyMetricSchema = bodyMetricBaseSchema.extend({
  userId: uuidSchema,
});

export const updateBodyMetricSchema = bodyMetricBaseSchema
  .partial()
  .extend({
    id: uuidSchema,
    userId: uuidSchema,
  })
  .refine(
    (value) =>
      ensureAtLeastOneDefined(value, [
        "measuredOn",
        "weightLb",
        "weightKg",
        "waistIn",
        "waistCm",
        "waistHipIn",
        "waistGutIn",
        "bodyFatPct",
        "muscleMassLb",
        "muscleMassKg",
        "notes",
        "source",
      ]),
    {
      message: "At least one field must be provided for update",
    },
  );

export const bodyMetricDateRangeQuerySchema = dateRangeQuerySchema;

export type CreateBodyMetricInput = z.infer<typeof createBodyMetricSchema>;
export type UpdateBodyMetricInput = z.infer<typeof updateBodyMetricSchema>;
export type BodyMetricDateRangeQuery = z.infer<
  typeof bodyMetricDateRangeQuerySchema
>;

export type BodyMetricTrendPointDto = {
  id: EntityId;
  measuredOn: string;
  weightLb: number | null;
  waistIn: number | null;
  bodyFatPct: number | null;
};

export interface BodyMetricRepository {
  create(input: CreateBodyMetricInput): Promise<BodyMetric>;
  upsertImported(input: CreateBodyMetricInput): Promise<BodyMetric>;
  update(input: UpdateBodyMetricInput): Promise<BodyMetric>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<BodyMetric | null>;
  listByDateRange(query: BodyMetricDateRangeQuery): Promise<BodyMetric[]>;
}

export class BodyMetricService {
  constructor(private readonly repository: BodyMetricRepository) {}

  async create(input: unknown) {
    return this.repository.create(createBodyMetricSchema.parse(input));
  }

  async upsertImported(input: unknown) {
    const parsed = createBodyMetricSchema.parse(input);

    if (parsed.source.sourceType !== "imported") {
      throw new Error(
        "Imported body metric upserts require an imported source.",
      );
    }

    return this.repository.upsertImported(parsed);
  }

  async update(input: unknown) {
    return this.repository.update(updateBodyMetricSchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async listByDateRange(input: unknown) {
    return this.repository.listByDateRange(
      bodyMetricDateRangeQuerySchema.parse(input),
    );
  }

  async listTrendPointsByDateRange(
    input: unknown,
  ): Promise<BodyMetricTrendPointDto[]> {
    const metrics = await this.listByDateRange(input);
    return metrics.map((metric) => ({
      id: metric.id,
      measuredOn: metric.measuredOn,
      weightLb: metric.weightLb,
      waistIn: metric.waistIn,
      bodyFatPct: metric.bodyFatPct,
    }));
  }
}
