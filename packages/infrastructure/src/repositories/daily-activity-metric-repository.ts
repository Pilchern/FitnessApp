import type { DailyActivityMetric } from "@fitness-app/domain";
import type {
  CreateDailyActivityMetricInput,
  DailyActivityMetricDateRangeQuery,
  DailyActivityMetricRepository,
  UpdateDailyActivityMetricInput,
} from "@fitness-app/application";
import { DEFAULT_DATE_RANGE_QUERY_LIMIT } from "@fitness-app/application";
import { z } from "zod";
import {
  compactRecord,
  type AppSupabaseClient,
  mapManualOrImportedSourceFromRow,
  requireSingleResult,
  throwOnError,
  toSourceColumns,
} from "./shared";

const dailyActivityMetricRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  metric_date: z.string(),
  steps: z.number().int().nullable(),
  vo2_max: z.number().nullable(),
  resting_heart_rate: z.number().nullable(),
  exercise_minutes: z.number().int().nullable(),
  active_energy_kcal: z.number().nullable(),
  source_type: z.enum(["manual", "imported"]),
  source_provider: z.string().nullable(),
  source_external_id: z.string().nullable(),
  import_batch_id: z.string().uuid().nullable(),
  raw_import_event_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type DailyActivityMetricRow = z.infer<typeof dailyActivityMetricRowSchema>;

export function mapDailyActivityMetricRow(
  row: DailyActivityMetricRow,
): DailyActivityMetric {
  return {
    id: row.id,
    userId: row.user_id,
    metricDate: row.metric_date,
    steps: row.steps,
    vo2Max: row.vo2_max,
    restingHeartRate: row.resting_heart_rate,
    exerciseMinutes: row.exercise_minutes,
    activeEnergyKcal: row.active_energy_kcal,
    source: mapManualOrImportedSourceFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toDailyActivityMetricInsert(input: CreateDailyActivityMetricInput) {
  return {
    user_id: input.userId,
    metric_date: input.metricDate,
    steps: input.steps ?? null,
    vo2_max: input.vo2Max ?? null,
    resting_heart_rate: input.restingHeartRate ?? null,
    exercise_minutes: input.exerciseMinutes ?? null,
    active_energy_kcal: input.activeEnergyKcal ?? null,
    ...toSourceColumns(input.source),
  };
}

function toDailyActivityMetricUpdate(input: UpdateDailyActivityMetricInput) {
  const sourceColumns =
    input.source === undefined ? undefined : toSourceColumns(input.source);

  return compactRecord({
    metric_date: input.metricDate,
    steps: input.steps,
    vo2_max: input.vo2Max,
    resting_heart_rate: input.restingHeartRate,
    exercise_minutes: input.exerciseMinutes,
    active_energy_kcal: input.activeEnergyKcal,
    ...sourceColumns,
  });
}

export class SupabaseDailyActivityMetricRepository implements DailyActivityMetricRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async create(input: CreateDailyActivityMetricInput) {
    const response = await this.client
      .from("daily_activity_metrics")
      .insert(toDailyActivityMetricInsert(input))
      .select("*")
      .single();

    return mapDailyActivityMetricRow(
      dailyActivityMetricRowSchema.parse(
        requireSingleResult(response, "Create daily activity metric"),
      ),
    );
  }

  async update(input: UpdateDailyActivityMetricInput) {
    const response = await this.client
      .from("daily_activity_metrics")
      .update(toDailyActivityMetricUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    return mapDailyActivityMetricRow(
      dailyActivityMetricRowSchema.parse(
        requireSingleResult(response, "Update daily activity metric"),
      ),
    );
  }

  async findByDate(userId: string, metricDate: string) {
    const response = await this.client
      .from("daily_activity_metrics")
      .select("*")
      .eq("user_id", userId)
      .eq("metric_date", metricDate)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch daily activity metric by date");

    return response.data
      ? mapDailyActivityMetricRow(
          dailyActivityMetricRowSchema.parse(response.data),
        )
      : null;
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("daily_activity_metrics")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch daily activity metric");

    return response.data
      ? mapDailyActivityMetricRow(
          dailyActivityMetricRowSchema.parse(response.data),
        )
      : null;
  }

  async archive(userId: string, id: string) {
    const response = await this.client
      .from("daily_activity_metrics")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive daily activity metric");
  }

  async listByDateRange(query: DailyActivityMetricDateRangeQuery) {
    let request = this.client
      .from("daily_activity_metrics")
      .select("*")
      .eq("user_id", query.userId)
      .is("deleted_at", null)
      .order("metric_date", { ascending: false })
      .limit(query.limit ?? DEFAULT_DATE_RANGE_QUERY_LIMIT);

    if (query.startDate) {
      request = request.gte("metric_date", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("metric_date", query.endDate);
    }

    const response = await request;
    throwOnError(response.error, "List daily activity metrics");

    return dailyActivityMetricRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapDailyActivityMetricRow);
  }
}
