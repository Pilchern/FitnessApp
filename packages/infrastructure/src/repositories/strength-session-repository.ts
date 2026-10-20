import type { StrengthSession, StrengthExerciseSet } from "@fitness-app/domain";
import type {
  CreateStrengthSessionInput,
  CreateWatchStrengthSessionInput,
  StrengthSessionDateRangeQuery,
  StrengthSessionRepository,
  UpdateStrengthSessionInput,
  WatchStrengthPatch,
  WatchStrengthRepository,
} from "@fitness-app/application";
import { DEFAULT_DATE_RANGE_QUERY_LIMIT } from "@fitness-app/application";
import { z } from "zod";
import {
  type AppSupabaseClient,
  mapManualOrImportedSourceFromRow,
  requireSingleResult,
  throwOnError,
  toSourceColumns,
} from "./shared";

const strengthSessionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  training_template_id: z.string().uuid().nullable(),
  // Optional so rows read before the program-link migration still parse.
  program_session_id: z.string().uuid().nullable().optional(),
  session_date: z.string(),
  session_name: z.string().nullable(),
  notes: z.string().nullable(),
  duration_minutes: z.number().int().nullable(),
  readiness_pre: z.number().int().nullable(),
  energy_post: z.number().int().nullable(),
  completed_as_planned: z.boolean(),
  // Optional so rows read before the watch-fields migration still parse.
  avg_heart_rate: z.number().int().nullable().optional(),
  max_heart_rate: z.number().int().nullable().optional(),
  active_energy_kcal: z.number().int().nullable().optional(),
  source_type: z.enum(["manual", "imported"]),
  source_provider: z.string().nullable(),
  source_external_id: z.string().nullable(),
  import_batch_id: z.string().uuid().nullable(),
  raw_import_event_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

const strengthSetRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  strength_session_id: z.string().uuid(),
  exercise_name: z.string(),
  exercise_order: z.number().int(),
  set_order: z.number().int(),
  reps: z.number().int().nullable(),
  weight: z.number().nullable(),
  rir: z.number().nullable(),
  is_warmup: z.boolean(),
  duration_seconds: z.number().int().nullable(),
  distance_meters: z.number().nullable(),
  // Optional so rows read before the program migration still parse.
  side: z.enum(["left", "right"]).nullable().optional(),
  peak_force_newtons: z.number().nullable().optional(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type StrengthSessionRow = z.infer<typeof strengthSessionRowSchema>;
type StrengthSetRow = z.infer<typeof strengthSetRowSchema>;

function mapStrengthSetRow(row: StrengthSetRow): StrengthExerciseSet {
  return {
    id: row.id,
    userId: row.user_id,
    strengthSessionId: row.strength_session_id,
    exerciseName: row.exercise_name,
    exerciseOrder: row.exercise_order,
    setNumber: row.set_order,
    reps: row.reps,
    weight: row.weight,
    rir: row.rir,
    isWarmup: row.is_warmup,
    durationSeconds: row.duration_seconds,
    distanceMeters: row.distance_meters,
    side: row.side ?? null,
    peakForceNewtons: row.peak_force_newtons ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapStrengthSessionRow(
  row: StrengthSessionRow,
  sets: StrengthExerciseSet[],
): StrengthSession {
  return {
    id: row.id,
    userId: row.user_id,
    trainingTemplateId: row.training_template_id,
    programSessionId: row.program_session_id ?? null,
    sessionDate: row.session_date,
    sessionName: row.session_name,
    notes: row.notes,
    durationMinutes: row.duration_minutes,
    readinessPre: row.readiness_pre,
    energyPost: row.energy_post,
    completedAsPlanned: row.completed_as_planned,
    avgHeartRate: row.avg_heart_rate ?? null,
    maxHeartRate: row.max_heart_rate ?? null,
    activeEnergyKcal: row.active_energy_kcal ?? null,
    source: mapManualOrImportedSourceFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    sets,
  };
}

function toStrengthSessionInsert(input: CreateStrengthSessionInput) {
  return {
    user_id: input.userId,
    session_date: input.sessionDate,
    session_name: input.sessionName ?? null,
    notes: input.notes ?? null,
    duration_minutes: input.durationMinutes ?? null,
    readiness_pre: input.readinessPre ?? null,
    energy_post: input.energyPost ?? null,
    completed_as_planned: input.completedAsPlanned,
    ...programSessionColumn(input.programSessionId),
    ...toSourceColumns(input.source),
  };
}

/**
 * Left out when undefined, so an update that does not mention the link (a
 * Watch merge, an edit on the same date) keeps it; null clears it.
 */
function programSessionColumn(programSessionId: string | null | undefined) {
  return programSessionId === undefined
    ? {}
    : { program_session_id: programSessionId };
}

function toStrengthSessionUpdate(input: UpdateStrengthSessionInput) {
  return {
    session_date: input.sessionDate,
    session_name: input.sessionName ?? null,
    notes: input.notes ?? null,
    duration_minutes: input.durationMinutes ?? null,
    readiness_pre: input.readinessPre ?? null,
    energy_post: input.energyPost ?? null,
    completed_as_planned: input.completedAsPlanned,
    ...programSessionColumn(input.programSessionId),
    ...toSourceColumns(input.source),
  };
}

function toStrengthSetInsert(
  userId: string,
  strengthSessionId: string,
  input: any,
) {
  return {
    user_id: userId,
    strength_session_id: strengthSessionId,
    exercise_name: input.exerciseName,
    exercise_order: input.exerciseOrder,
    set_order: input.setNumber,
    reps: input.reps ?? null,
    weight: input.weight ?? null,
    rir: input.rir ?? null,
    is_warmup: input.isWarmup ?? false,
    duration_seconds: input.durationSeconds ?? null,
    distance_meters: input.distanceMeters ?? null,
    // Only sent when set, so bilateral saves work before the column exists.
    ...(input.side ? { side: input.side } : {}),
    ...(input.peakForceNewtons != null
      ? { peak_force_newtons: input.peakForceNewtons }
      : {}),
    notes: input.notes ?? null,
  };
}

const SESSION_ID_CHUNK_SIZE = 100;
const SET_PAGE_SIZE = 1000;

export class SupabaseStrengthSessionRepository
  implements StrengthSessionRepository, WatchStrengthRepository
{
  constructor(private readonly client: AppSupabaseClient) {}

  private async loadSetsForSessions(userId: string, sessionIds: string[]) {
    const setsBySession = new Map<string, StrengthExerciseSet[]>();

    // PostgREST caps a response at 1000 rows and long `in` lists blow the URL
    // length, so chunk the ids and page each chunk until a short page comes
    // back. The order is total, so pages never skip or repeat a row.
    for (
      let start = 0;
      start < sessionIds.length;
      start += SESSION_ID_CHUNK_SIZE
    ) {
      const chunk = sessionIds.slice(start, start + SESSION_ID_CHUNK_SIZE);

      for (let offset = 0; ; offset += SET_PAGE_SIZE) {
        const response = await this.client
          .from("strength_exercise_sets")
          .select("*")
          .eq("user_id", userId)
          .in("strength_session_id", chunk)
          .is("deleted_at", null)
          .order("strength_session_id", { ascending: true })
          .order("exercise_order", { ascending: true })
          .order("set_order", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + SET_PAGE_SIZE - 1);

        throwOnError(response.error, "List strength sets");

        const rows = strengthSetRowSchema.array().parse(response.data ?? []);
        rows.forEach((row) => {
          const existing = setsBySession.get(row.strength_session_id) ?? [];
          existing.push(mapStrengthSetRow(row));
          setsBySession.set(row.strength_session_id, existing);
        });

        if (rows.length < SET_PAGE_SIZE) break;
      }
    }

    return setsBySession;
  }

  async create(input: CreateStrengthSessionInput) {
    const sessionResponse = await this.client
      .from("strength_sessions")
      .insert(toStrengthSessionInsert(input))
      .select("*")
      .single();

    const sessionRow = strengthSessionRowSchema.parse(
      requireSingleResult(sessionResponse, "Create strength session"),
    );

    const setsResponse = await this.client
      .from("strength_exercise_sets")
      .insert(
        input.sets.map((set) =>
          toStrengthSetInsert(input.userId, sessionRow.id, set),
        ),
      )
      .select("*");

    throwOnError(setsResponse.error, "Create strength sets");

    const sets = strengthSetRowSchema
      .array()
      .parse(setsResponse.data ?? [])
      .map(mapStrengthSetRow);

    return mapStrengthSessionRow(sessionRow, sets);
  }

  async update(input: UpdateStrengthSessionInput) {
    const sessionResponse = await this.client
      .from("strength_sessions")
      .update(toStrengthSessionUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    const sessionRow = strengthSessionRowSchema.parse(
      requireSingleResult(sessionResponse, "Update strength session"),
    );

    const archiveResponse = await this.client
      .from("strength_exercise_sets")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("strength_session_id", input.id)
      .eq("user_id", input.userId)
      .is("deleted_at", null);

    throwOnError(archiveResponse.error, "Archive existing strength sets");

    const setsResponse = await this.client
      .from("strength_exercise_sets")
      .insert(
        input.sets.map((set) =>
          toStrengthSetInsert(input.userId, input.id, set),
        ),
      )
      .select("*");

    throwOnError(setsResponse.error, "Replace strength sets");

    const sets = strengthSetRowSchema
      .array()
      .parse(setsResponse.data ?? [])
      .map(mapStrengthSetRow);

    return mapStrengthSessionRow(sessionRow, sets);
  }

  async archive(userId: string, id: string) {
    const response = await this.client
      .from("strength_sessions")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive strength session");
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("strength_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch strength session");

    if (!response.data) {
      return null;
    }

    const sessionRow = strengthSessionRowSchema.parse(response.data);
    const setsBySession = await this.loadSetsForSessions(userId, [id]);
    return mapStrengthSessionRow(sessionRow, setsBySession.get(id) ?? []);
  }

  async listByDateRange(query: StrengthSessionDateRangeQuery) {
    let request = this.client
      .from("strength_sessions")
      .select("*")
      .eq("user_id", query.userId)
      .is("deleted_at", null)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(query.limit ?? DEFAULT_DATE_RANGE_QUERY_LIMIT);

    if (query.startDate) {
      request = request.gte("session_date", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("session_date", query.endDate);
    }

    const response = await request;
    throwOnError(response.error, "List strength sessions");

    const rows = strengthSessionRowSchema.array().parse(response.data ?? []);
    const setsBySession = await this.loadSetsForSessions(
      query.userId,
      rows.map((row) => row.id),
    );

    return rows.map((row) =>
      mapStrengthSessionRow(row, setsBySession.get(row.id) ?? []),
    );
  }

  async startedAtByIds(userId: string, ids: string[]) {
    if (ids.length === 0) return {};
    const response = await this.client
      .from("strength_sessions")
      .select("id, started_at")
      .eq("user_id", userId)
      .in("id", ids);
    throwOnError(response.error, "Read strength session start times");
    return Object.fromEntries(
      (
        (response.data ?? []) as { id: string; started_at: string | null }[]
      ).map((row) => [row.id, row.started_at]),
    );
  }

  async patchWatchFields(
    userId: string,
    id: string,
    patch: WatchStrengthPatch,
  ) {
    const columns: Record<string, string | number | null> = {};
    if (patch.startedAt) columns.started_at = patch.startedAt;
    if (patch.endedAt !== undefined) columns.ended_at = patch.endedAt;
    if (patch.durationMinutes != null)
      columns.duration_minutes = patch.durationMinutes;
    if (patch.avgHeartRate != null) columns.avg_heart_rate = patch.avgHeartRate;
    if (patch.maxHeartRate != null) columns.max_heart_rate = patch.maxHeartRate;
    if (patch.activeEnergyKcal != null)
      columns.active_energy_kcal = patch.activeEnergyKcal;
    if (Object.keys(columns).length === 0) return;

    // Session row only: the sets are the logger's and are never touched here.
    const response = await this.client
      .from("strength_sessions")
      .update(columns)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    throwOnError(response.error, "Merge Apple Watch workout into session");
  }

  async createFromWatch(input: CreateWatchStrengthSessionInput) {
    const response = await this.client
      .from("strength_sessions")
      .insert({
        user_id: input.userId,
        session_date: input.sessionDate,
        session_name: input.sessionName,
        started_at: input.startedAt,
        ended_at: input.endedAt,
        duration_minutes: input.durationMinutes,
        avg_heart_rate: input.avgHeartRate,
        max_heart_rate: input.maxHeartRate,
        active_energy_kcal: input.activeEnergyKcal,
        completed_as_planned: true,
        source_type: "imported",
        source_provider: "apple_health",
        source_external_id: input.externalId,
      })
      .select("*")
      .single();

    const row = strengthSessionRowSchema.parse(
      requireSingleResult(response, "Create session from Apple Watch workout"),
    );
    return mapStrengthSessionRow(row, []);
  }

  async hasExternalId(userId: string, externalId: string) {
    const response = await this.client
      .from("strength_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("source_provider", "apple_health")
      .eq("source_external_id", externalId)
      .limit(1);
    throwOnError(response.error, "Look up Apple Watch strength session");
    return (response.data ?? []).length > 0;
  }
}
