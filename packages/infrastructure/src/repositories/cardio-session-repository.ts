import type {
  CardioSession,
} from "@fitness-app/domain";
import type {
  CardioSessionRepository,
  CreateCardioSessionInput,
  UpdateCardioSessionInput,
  CardioSessionDateRangeQuery,
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

const cardioSessionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  training_template_id: z.string().uuid().nullable(),
  session_date: z.string(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  session_kind: z.enum(["zone2", "vo2", "recovery", "other"]),
  planned_vs_completed: z.enum(["planned", "completed", "partial", "skipped"]),
  duration_minutes: z.number().int().nullable(),
  zone2_minutes: z.number().int().nullable(),
  avg_heart_rate: z.number().int().nullable(),
  max_heart_rate: z.number().int().nullable(),
  avg_output: z.number().nullable(),
  cadence_min: z.number().int().nullable(),
  cadence_max: z.number().int().nullable(),
  resistance_min: z.number().nullable(),
  resistance_max: z.number().nullable(),
  interval_structure: z.string().nullable(),
  rpe: z.number().nullable(),
  distance_meters: z.number().nullable(),
  notes: z.string().nullable(),
  sport_type: z.string().nullable(),
  source_type: z.enum(["manual", "imported"]),
  source_provider: z.string().nullable(),
  source_external_id: z.string().nullable(),
  import_batch_id: z.string().uuid().nullable(),
  raw_import_event_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type CardioSessionRow = z.infer<typeof cardioSessionRowSchema>;

export function mapCardioSessionRow(row: CardioSessionRow): CardioSession {
  return {
    id: row.id,
    userId: row.user_id,
    trainingTemplateId: row.training_template_id,
    sessionDate: row.session_date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    sessionKind: row.session_kind,
    plannedVsCompleted: row.planned_vs_completed,
    durationMinutes: row.duration_minutes,
    zone2Minutes: row.zone2_minutes,
    avgHeartRate: row.avg_heart_rate,
    maxHeartRate: row.max_heart_rate,
    avgOutput: row.avg_output,
    cadenceMin: row.cadence_min,
    cadenceMax: row.cadence_max,
    resistanceMin: row.resistance_min,
    resistanceMax: row.resistance_max,
    intervalStructure: row.interval_structure,
    rpe: row.rpe,
    distanceMeters: row.distance_meters,
    notes: row.notes,
    sportType: row.sport_type,
    source: mapManualOrImportedSourceFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toCardioSessionInsert(input: CreateCardioSessionInput) {
  return {
    user_id: input.userId,
    training_template_id: input.trainingTemplateId ?? null,
    session_date: input.sessionDate,
    started_at: input.startedAt ?? null,
    ended_at: input.endedAt ?? null,
    session_kind: input.sessionKind,
    planned_vs_completed: input.plannedVsCompleted,
    duration_minutes: input.durationMinutes ?? null,
    zone2_minutes: input.zone2Minutes ?? null,
    avg_heart_rate: input.avgHeartRate ?? null,
    max_heart_rate: input.maxHeartRate ?? null,
    avg_output: input.avgOutput ?? null,
    cadence_min: input.cadenceMin ?? null,
    cadence_max: input.cadenceMax ?? null,
    resistance_min: input.resistanceMin ?? null,
    resistance_max: input.resistanceMax ?? null,
    interval_structure: input.intervalStructure ?? null,
    rpe: input.rpe ?? null,
    distance_meters: input.distanceMeters ?? null,
    notes: input.notes ?? null,
    sport_type: input.sportType ?? null,
    ...toSourceColumns(input.source),
  };
}

function toCardioSessionUpdate(input: UpdateCardioSessionInput) {
  const sourceColumns =
    input.source === undefined ? undefined : toSourceColumns(input.source);

  return compactRecord({
    training_template_id: input.trainingTemplateId,
    session_date: input.sessionDate,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    session_kind: input.sessionKind,
    planned_vs_completed: input.plannedVsCompleted,
    duration_minutes: input.durationMinutes,
    zone2_minutes: input.zone2Minutes,
    avg_heart_rate: input.avgHeartRate,
    max_heart_rate: input.maxHeartRate,
    avg_output: input.avgOutput,
    cadence_min: input.cadenceMin,
    cadence_max: input.cadenceMax,
    resistance_min: input.resistanceMin,
    resistance_max: input.resistanceMax,
    interval_structure: input.intervalStructure,
    rpe: input.rpe,
    distance_meters: input.distanceMeters,
    notes: input.notes,
    ...sourceColumns,
  });
}

export class SupabaseCardioSessionRepository implements CardioSessionRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async create(input: CreateCardioSessionInput) {
    const response = await this.client
      .from("cardio_sessions")
      .insert(toCardioSessionInsert(input))
      .select("*")
      .single();

    return mapCardioSessionRow(
      cardioSessionRowSchema.parse(
        requireSingleResult(response, "Create cardio session"),
      ),
    );
  }

  async update(input: UpdateCardioSessionInput) {
    const response = await this.client
      .from("cardio_sessions")
      .update(toCardioSessionUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    return mapCardioSessionRow(
      cardioSessionRowSchema.parse(
        requireSingleResult(response, "Update cardio session"),
      ),
    );
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("cardio_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch cardio session");

    return response.data
      ? mapCardioSessionRow(cardioSessionRowSchema.parse(response.data))
      : null;
  }

  async findByExternalId(
    userId: string,
    sourceProvider: string,
    sourceExternalId: string,
  ) {
    const response = await this.client
      .from("cardio_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("source_provider", sourceProvider)
      .eq("source_external_id", sourceExternalId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Find cardio session by external id");

    return response.data
      ? mapCardioSessionRow(cardioSessionRowSchema.parse(response.data))
      : null;
  }

  async archive(userId: string, id: string) {
    const response = await this.client
      .from("cardio_sessions")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive cardio session");
  }

  async listByDateRange(query: CardioSessionDateRangeQuery) {
    let request = this.client
      .from("cardio_sessions")
      .select("*")
      .eq("user_id", query.userId)
      .is("deleted_at", null)
      .order("session_date", { ascending: false })
      .limit(500);

    if (query.startDate) {
      request = request.gte("session_date", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("session_date", query.endDate);
    }

    const response = await request;
    throwOnError(response.error, "List cardio sessions");

    return cardioSessionRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapCardioSessionRow);
  }
}
