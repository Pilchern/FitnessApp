import type { StrengthSession, StrengthExerciseSet } from "@fitness-app/domain";
import type {
  CreateStrengthSessionInput,
  StrengthSessionDateRangeQuery,
  StrengthSessionRepository,
  UpdateStrengthSessionInput,
} from "@fitness-app/application";
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
  session_date: z.string(),
  session_name: z.string().nullable(),
  notes: z.string().nullable(),
  duration_minutes: z.number().int().nullable(),
  readiness_pre: z.number().int().nullable(),
  energy_post: z.number().int().nullable(),
  completed_as_planned: z.boolean(),
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
    sessionDate: row.session_date,
    sessionName: row.session_name,
    notes: row.notes,
    durationMinutes: row.duration_minutes,
    readinessPre: row.readiness_pre,
    energyPost: row.energy_post,
    completedAsPlanned: row.completed_as_planned,
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
    ...toSourceColumns(input.source),
  };
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
    ...toSourceColumns(input.source),
  };
}

function toStrengthSetInsert(userId: string, strengthSessionId: string, input: any) {
  return {
    user_id: userId,
    strength_session_id: strengthSessionId,
    exercise_name: input.exerciseName,
    exercise_order: input.exerciseOrder,
    set_order: input.setNumber,
    reps: input.reps ?? null,
    weight: input.weight ?? null,
    rir: input.rir ?? null,
    notes: input.notes ?? null,
  };
}

export class SupabaseStrengthSessionRepository implements StrengthSessionRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  private async loadSetsForSessions(userId: string, sessionIds: string[]) {
    if (sessionIds.length === 0) {
      return new Map<string, StrengthExerciseSet[]>();
    }

    const response = await this.client
      .from("strength_exercise_sets")
      .select("*")
      .eq("user_id", userId)
      .in("strength_session_id", sessionIds)
      .is("deleted_at", null)
      .order("exercise_order", { ascending: true })
      .order("set_order", { ascending: true });

    throwOnError(response.error, "List strength sets");

    const rows = strengthSetRowSchema.array().parse(response.data ?? []);
    const setsBySession = new Map<string, StrengthExerciseSet[]>();

    rows.forEach((row) => {
      const existing = setsBySession.get(row.strength_session_id) ?? [];
      existing.push(mapStrengthSetRow(row));
      setsBySession.set(row.strength_session_id, existing);
    });

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
      .insert(input.sets.map((set) => toStrengthSetInsert(input.userId, sessionRow.id, set)))
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
      .insert(input.sets.map((set) => toStrengthSetInsert(input.userId, input.id, set)))
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
      .limit(500);

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

    return rows.map((row) => mapStrengthSessionRow(row, setsBySession.get(row.id) ?? []));
  }
}
