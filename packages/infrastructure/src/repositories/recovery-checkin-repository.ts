import type { RecoveryCheckin } from "@fitness-app/domain";
import type {
  CreateRecoveryCheckinInput,
  RecoveryCheckinDateRangeQuery,
  RecoveryCheckinRepository,
  UpdateRecoveryCheckinInput,
} from "@fitness-app/application";
import { z } from "zod";
import {
  compactRecord,
  type AppSupabaseClient,
  mapCanonicalSourceFromRow,
  requireSingleResult,
  throwOnError,
  toSourceColumns,
} from "./shared";

const recoveryCheckinRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  checkin_date: z.string(),
  resting_heart_rate: z.number().int().nullable(),
  hrv: z.number().nullable(),
  sleep_duration_minutes: z.number().int().nullable(),
  sleep_quality: z.number().int().nullable(),
  energy_level: z.number().int().nullable(),
  readiness_level: z.number().int().nullable(),
  stress_level: z.number().int().nullable(),
  soreness_level: z.number().int().nullable(),
  alcohol_count: z.number().int(),
  notes: z.string().nullable(),
  time_in_bed_minutes: z.number().int().nullable(),
  sleep_efficiency_pct: z.number().nullable(),
  deep_sleep_minutes: z.number().int().nullable(),
  rem_sleep_minutes: z.number().int().nullable(),
  core_sleep_minutes: z.number().int().nullable(),
  awake_minutes: z.number().int().nullable(),
  sleep_respiratory_rate: z.number().nullable(),
  sleep_spo2_avg_pct: z.number().nullable(),
  sleep_hrv_avg: z.number().nullable(),
  sleep_avg_heart_rate: z.number().int().nullable(),
  source_type: z.enum(["manual", "imported", "mixed"]),
  source_provider: z.string().nullable(),
  source_external_id: z.string().nullable(),
  import_batch_id: z.string().uuid().nullable(),
  raw_import_event_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type RecoveryCheckinRow = z.infer<typeof recoveryCheckinRowSchema>;

export function mapRecoveryCheckinRow(row: RecoveryCheckinRow): RecoveryCheckin {
  return {
    id: row.id,
    userId: row.user_id,
    checkinDate: row.checkin_date,
    restingHeartRate: row.resting_heart_rate,
    hrv: row.hrv,
    sleepDurationMinutes: row.sleep_duration_minutes,
    sleepQuality: row.sleep_quality,
    energyLevel: row.energy_level,
    readinessLevel: row.readiness_level,
    stressLevel: row.stress_level,
    sorenessLevel: row.soreness_level,
    alcoholCount: row.alcohol_count,
    notes: row.notes,
    timeInBedMinutes: row.time_in_bed_minutes,
    sleepEfficiencyPct: row.sleep_efficiency_pct,
    deepSleepMinutes: row.deep_sleep_minutes,
    remSleepMinutes: row.rem_sleep_minutes,
    coreSleepMinutes: row.core_sleep_minutes,
    awakeMinutes: row.awake_minutes,
    sleepRespiratoryRate: row.sleep_respiratory_rate,
    sleepSpo2AvgPct: row.sleep_spo2_avg_pct,
    sleepHrvAvg: row.sleep_hrv_avg,
    sleepAvgHeartRate: row.sleep_avg_heart_rate,
    source: mapCanonicalSourceFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toRecoveryCheckinInsert(input: CreateRecoveryCheckinInput) {
  return {
    user_id: input.userId,
    checkin_date: input.checkinDate,
    resting_heart_rate: input.restingHeartRate ?? null,
    hrv: input.hrv ?? null,
    sleep_duration_minutes: input.sleepDurationMinutes ?? null,
    sleep_quality: input.sleepQuality ?? null,
    energy_level: input.energyLevel ?? null,
    readiness_level: input.readinessLevel ?? null,
    stress_level: input.stressLevel ?? null,
    soreness_level: input.sorenessLevel ?? null,
    alcohol_count: input.alcoholCount,
    notes: input.notes ?? null,
    time_in_bed_minutes: input.timeInBedMinutes ?? null,
    sleep_efficiency_pct: input.sleepEfficiencyPct ?? null,
    deep_sleep_minutes: input.deepSleepMinutes ?? null,
    rem_sleep_minutes: input.remSleepMinutes ?? null,
    core_sleep_minutes: input.coreSleepMinutes ?? null,
    awake_minutes: input.awakeMinutes ?? null,
    sleep_respiratory_rate: input.sleepRespiratoryRate ?? null,
    sleep_spo2_avg_pct: input.sleepSpo2AvgPct ?? null,
    sleep_hrv_avg: input.sleepHrvAvg ?? null,
    sleep_avg_heart_rate: input.sleepAvgHeartRate ?? null,
    ...toSourceColumns(input.source),
  };
}

function toRecoveryCheckinUpdate(input: UpdateRecoveryCheckinInput) {
  const sourceColumns =
    input.source === undefined ? undefined : toSourceColumns(input.source);

  return compactRecord({
    checkin_date: input.checkinDate,
    resting_heart_rate: input.restingHeartRate,
    hrv: input.hrv,
    sleep_duration_minutes: input.sleepDurationMinutes,
    sleep_quality: input.sleepQuality,
    energy_level: input.energyLevel,
    readiness_level: input.readinessLevel,
    stress_level: input.stressLevel,
    soreness_level: input.sorenessLevel,
    alcohol_count: input.alcoholCount,
    notes: input.notes,
    time_in_bed_minutes: input.timeInBedMinutes,
    sleep_efficiency_pct: input.sleepEfficiencyPct,
    deep_sleep_minutes: input.deepSleepMinutes,
    rem_sleep_minutes: input.remSleepMinutes,
    core_sleep_minutes: input.coreSleepMinutes,
    awake_minutes: input.awakeMinutes,
    sleep_respiratory_rate: input.sleepRespiratoryRate,
    sleep_spo2_avg_pct: input.sleepSpo2AvgPct,
    sleep_hrv_avg: input.sleepHrvAvg,
    sleep_avg_heart_rate: input.sleepAvgHeartRate,
    ...sourceColumns,
  });
}

export class SupabaseRecoveryCheckinRepository
  implements RecoveryCheckinRepository
{
  constructor(private readonly client: AppSupabaseClient) {}

  async create(input: CreateRecoveryCheckinInput) {
    const response = await this.client
      .from("recovery_checkins")
      .insert(toRecoveryCheckinInsert(input))
      .select("*")
      .single();

    return mapRecoveryCheckinRow(
      recoveryCheckinRowSchema.parse(
        requireSingleResult(response, "Create recovery checkin"),
      ),
    );
  }

  async update(input: UpdateRecoveryCheckinInput) {
    const response = await this.client
      .from("recovery_checkins")
      .update(toRecoveryCheckinUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    return mapRecoveryCheckinRow(
      recoveryCheckinRowSchema.parse(
        requireSingleResult(response, "Update recovery checkin"),
      ),
    );
  }

  async findByDate(userId: string, checkinDate: string) {
    const response = await this.client
      .from("recovery_checkins")
      .select("*")
      .eq("user_id", userId)
      .eq("checkin_date", checkinDate)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch recovery checkin by date");

    return response.data
      ? mapRecoveryCheckinRow(recoveryCheckinRowSchema.parse(response.data))
      : null;
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("recovery_checkins")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch recovery checkin");

    return response.data
      ? mapRecoveryCheckinRow(recoveryCheckinRowSchema.parse(response.data))
      : null;
  }

  async archive(userId: string, id: string) {
    const response = await this.client
      .from("recovery_checkins")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive recovery checkin");
  }

  async listByDateRange(query: RecoveryCheckinDateRangeQuery) {
    let request = this.client
      .from("recovery_checkins")
      .select("*")
      .eq("user_id", query.userId)
      .is("deleted_at", null)
      .order("checkin_date", { ascending: false })
      .limit(500);

    if (query.startDate) {
      request = request.gte("checkin_date", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("checkin_date", query.endDate);
    }

    const response = await request;
    throwOnError(response.error, "List recovery checkins");

    return recoveryCheckinRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapRecoveryCheckinRow);
  }
}
