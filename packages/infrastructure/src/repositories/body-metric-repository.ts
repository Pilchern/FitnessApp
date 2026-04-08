import type { BodyMetric } from "@fitness-app/domain";
import type {
  BodyMetricDateRangeQuery,
  BodyMetricRepository,
  CreateBodyMetricInput,
  UpdateBodyMetricInput,
} from "@fitness-app/application";
import { z } from "zod";
import {
  compactRecord,
  type AppSupabaseClient,
  mapManualOrImportedSourceFromRow,
  requireSingleResult,
  throwOnError,
  toSourceColumns,
} from "./shared";

const bodyMetricRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  measured_on: z.string(),
  weight_lb: z.number().nullable(),
  weight_kg: z.number().nullable(),
  waist_in: z.number().nullable(),
  waist_cm: z.number().nullable(),
  body_fat_pct: z.number().nullable(),
  muscle_mass_lb: z.number().nullable(),
  muscle_mass_kg: z.number().nullable(),
  bone_mass_kg: z.number().nullable(),
  bone_mass_lb: z.number().nullable(),
  fat_free_mass_kg: z.number().nullable(),
  fat_free_mass_lb: z.number().nullable(),
  hydration_pct: z.number().nullable(),
  visceral_fat_index: z.number().int().nullable(),
  notes: z.string().nullable(),
  source_type: z.enum(["manual", "imported"]),
  source_provider: z.string().nullable(),
  source_external_id: z.string().nullable(),
  import_batch_id: z.string().uuid().nullable(),
  raw_import_event_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type BodyMetricRow = z.infer<typeof bodyMetricRowSchema>;

export function mapBodyMetricRow(row: BodyMetricRow): BodyMetric {
  return {
    id: row.id,
    userId: row.user_id,
    measuredOn: row.measured_on,
    weightLb: row.weight_lb,
    weightKg: row.weight_kg,
    waistIn: row.waist_in,
    waistCm: row.waist_cm,
    bodyFatPct: row.body_fat_pct,
    muscleMassLb: row.muscle_mass_lb,
    muscleMassKg: row.muscle_mass_kg,
    boneMassKg: row.bone_mass_kg,
    boneMassLb: row.bone_mass_lb,
    fatFreeMassKg: row.fat_free_mass_kg,
    fatFreeMassLb: row.fat_free_mass_lb,
    hydrationPct: row.hydration_pct,
    visceralFatIndex: row.visceral_fat_index,
    notes: row.notes,
    source: mapManualOrImportedSourceFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toBodyMetricInsert(input: CreateBodyMetricInput) {
  return {
    user_id: input.userId,
    measured_on: input.measuredOn,
    weight_lb: input.weightLb ?? null,
    weight_kg: input.weightKg ?? null,
    waist_in: input.waistIn ?? null,
    waist_cm: input.waistCm ?? null,
    body_fat_pct: input.bodyFatPct ?? null,
    muscle_mass_lb: input.muscleMassLb ?? null,
    muscle_mass_kg: input.muscleMassKg ?? null,
    bone_mass_kg: input.boneMassKg ?? null,
    bone_mass_lb: input.boneMassLb ?? null,
    fat_free_mass_kg: input.fatFreeMassKg ?? null,
    fat_free_mass_lb: input.fatFreeMassLb ?? null,
    hydration_pct: input.hydrationPct ?? null,
    visceral_fat_index: input.visceralFatIndex ?? null,
    notes: input.notes ?? null,
    ...toSourceColumns(input.source),
  };
}

function toBodyMetricUpdate(input: UpdateBodyMetricInput) {
  const sourceColumns =
    input.source === undefined ? undefined : toSourceColumns(input.source);

  return compactRecord({
    measured_on: input.measuredOn,
    weight_lb: input.weightLb,
    weight_kg: input.weightKg,
    waist_in: input.waistIn,
    waist_cm: input.waistCm,
    body_fat_pct: input.bodyFatPct,
    muscle_mass_lb: input.muscleMassLb,
    muscle_mass_kg: input.muscleMassKg,
    notes: input.notes,
    ...sourceColumns,
  });
}

export class SupabaseBodyMetricRepository implements BodyMetricRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async create(input: CreateBodyMetricInput) {
    const response = await this.client
      .from("body_metrics")
      .insert(toBodyMetricInsert(input))
      .select("*")
      .single();

    return mapBodyMetricRow(
      bodyMetricRowSchema.parse(requireSingleResult(response, "Create body metric")),
    );
  }

  async upsertImported(input: CreateBodyMetricInput) {
    if (input.source.sourceType !== "imported") {
      throw new Error("Imported upserts require an imported source.");
    }

    const sourceExternalId = input.source.sourceExternalId;

    if (!sourceExternalId) {
      return this.create(input);
    }

    const existingResponse = await this.client
      .from("body_metrics")
      .select("*")
      .eq("user_id", input.userId)
      .eq("source_provider", input.source.sourceProvider)
      .eq("source_external_id", sourceExternalId)
      .maybeSingle();

    throwOnError(existingResponse.error, "Lookup imported body metric");

    if (!existingResponse.data) {
      return this.create(input);
    }

    const response = await this.client
      .from("body_metrics")
      .update({
        ...toBodyMetricInsert(input),
        deleted_at: null,
      })
      .eq("id", existingResponse.data.id)
      .select("*")
      .single();

    return mapBodyMetricRow(
      bodyMetricRowSchema.parse(
        requireSingleResult(response, "Upsert imported body metric"),
      ),
    );
  }

  async update(input: UpdateBodyMetricInput) {
    const response = await this.client
      .from("body_metrics")
      .update(toBodyMetricUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    return mapBodyMetricRow(
      bodyMetricRowSchema.parse(requireSingleResult(response, "Update body metric")),
    );
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("body_metrics")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch body metric");

    return response.data
      ? mapBodyMetricRow(bodyMetricRowSchema.parse(response.data))
      : null;
  }

  async archive(userId: string, id: string) {
    const response = await this.client
      .from("body_metrics")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive body metric");
  }

  async listByDateRange(query: BodyMetricDateRangeQuery) {
    let request = this.client
      .from("body_metrics")
      .select("*")
      .eq("user_id", query.userId)
      .is("deleted_at", null)
      .order("measured_on", { ascending: false })
      .limit(500);

    if (query.startDate) {
      request = request.gte("measured_on", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("measured_on", query.endDate);
    }

    const response = await request;
    throwOnError(response.error, "List body metrics");

    return bodyMetricRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapBodyMetricRow);
  }
}
