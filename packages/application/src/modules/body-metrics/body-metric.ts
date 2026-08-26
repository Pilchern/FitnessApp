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
import {
  type CrossProviderDecision,
  decideBodyMetricCrossProvider,
} from "../integrations/cross-provider-dedup";

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

  /**
   * Inserts an imported body metric, skipping it when the same real-world
   * weigh-in is already stored.
   *
   * The repository handles the same-provider case (a re-import of the same
   * `sourceExternalId` updates the existing row). This method adds the
   * cross-provider case (TD-019): the same weigh-in can reach the app from
   * two different providers with different external ids — a Withings scale
   * reading and the same reading relayed through an Apple Health bridge —
   * and neither the unique index nor the repository's own check sees the
   * collision. Every metric already stored for that calendar day is compared
   * against the incoming one; on a match the higher-priority source wins.
   * See `cross-provider-dedup.ts` for the matching rules and priority order.
   *
   * When the incoming metric wins, the superseded row is archived — a soft
   * delete, so nothing is unrecoverable if the heuristic ever gets it wrong.
   */
  async upsertImported(input: unknown): Promise<{
    metric: BodyMetric;
    crossProvider: CrossProviderDecision;
  }> {
    const parsed = createBodyMetricSchema.parse(input);

    if (parsed.source.sourceType !== "imported") {
      throw new Error(
        "Imported body metric upserts require an imported source.",
      );
    }

    const sameDayExisting = await this.repository.listByDateRange({
      userId: parsed.userId,
      startDate: parsed.measuredOn,
      endDate: parsed.measuredOn,
    });
    const decision = decideBodyMetricCrossProvider(
      {
        measuredOn: parsed.measuredOn,
        weightLb: parsed.weightLb ?? null,
        weightKg: parsed.weightKg ?? null,
        source: parsed.source,
      },
      sameDayExisting,
    );

    if (decision.outcome === "skip_incoming") {
      const winner = sameDayExisting.find(
        (candidate) => candidate.id === decision.duplicateOf,
      );
      // `duplicateOf` always names a member of the list the decision was made
      // from, so this fallback is unreachable in practice — it exists so a
      // future refactor of the lookup can't turn a miss into a crash.
      if (winner) {
        return { metric: winner, crossProvider: decision };
      }
    }

    const metric = await this.repository.upsertImported(parsed);

    // `repository.upsertImported` has tombstone semantics: if this provider's
    // external id was previously soft-deleted by the user, it refuses to
    // resurrect the row and hands back the tombstone without writing
    // anything. Archiving the loser in that case would leave the day with no
    // live record at all -- both the row we thought we wrote and the one we
    // superseded gone -- and it would repeat on every sync. A returned row
    // that is still deleted means nothing was stored, so there is nothing to
    // supersede.
    if (decision.outcome === "supersede_existing" && metric.deletedAt == null) {
      await this.repository.archive(parsed.userId, decision.duplicateOf);
      return { metric, crossProvider: decision };
    }

    if (decision.outcome === "supersede_existing") {
      return {
        metric,
        crossProvider: {
          outcome: "skip_incoming",
          duplicateOf: decision.duplicateOf,
          reason:
            "Skipped: this measurement was previously deleted for this " +
            "provider, so it was not re-imported and the existing record " +
            "was left in place.",
        },
      };
    }

    return { metric, crossProvider: decision };
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
