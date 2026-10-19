import type {
  KneeSwelling,
  ProgramBlock,
  ProgramExercise,
  ProgramGate,
  ProgramSession,
  ProgramWeek,
  TrainingProgram,
} from "@fitness-app/domain";
import type {
  ClearOutcomeInput,
  DatedKneeCheck,
  ProgramRepository,
  SaveKneeCheckInput,
  SaveOutcomeInput,
  SaveWeeklyCheckinInput,
  SetGateClearedInput,
  UpdateSettingInput,
} from "@fitness-app/application";
import type {
  ProgramSessionOutcome,
  ProgramWeeklyCheckin,
  TrainingSetting,
} from "@fitness-app/domain";
import { z } from "zod";
import { type AppSupabaseClient, throwOnError } from "./shared";

// numeric columns arrive as numbers from PostgREST; smallint as numbers.
const num = z.number().nullable();

const programRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  version: z.string().nullable().optional(),
  week_anchor_date: z.string(),
  return_to_sport_week: num,
  test_day_url: z.string().nullable(),
  notes: z.string().nullable(),
});

const blockRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  start_week: z.number(),
  end_week: z.number(),
  sets_min: num,
  sets_max: num,
  reps_min: num,
  reps_max: num,
  rir_target: num,
  rep_scheme: z.string().nullable(),
  sessions_from_block_id: z.string().uuid().nullable(),
  // Optional with defaults: rows read before the v1 migration lack them.
  activation: z.enum(["week", "gate", "manual"]).optional().default("week"),
  gate_key: z.string().nullable().optional().default(null),
  fallback_block_id: z.string().uuid().nullable().optional().default(null),
  activated_on: z.string().nullable().optional().default(null),
  notes: z.string().nullable(),
});

const weekRowSchema = z.object({
  week_number: z.number(),
  is_deload: z.boolean(),
  notes: z.string().nullable(),
});

const gateRowSchema = z.object({
  id: z.string().uuid(),
  gate_key: z.string(),
  label: z.string(),
  cleared_on: z.string().nullable(),
  earliest_on: z.string().nullable(),
  notes: z.string().nullable(),
});

const sessionRowSchema = z.object({
  id: z.string().uuid(),
  block_id: z.string().uuid(),
  day_of_week: z.number(),
  sort_order: z.number(),
  session_type: z.enum([
    "lift",
    "peloton",
    "run",
    "test",
    "rest",
    "walk_jog",
    "walk",
    "golf",
    "accessory",
  ]),
  name: z.string(),
  upper_template_id: z.string().uuid().nullable(),
  ride_kind: z
    .enum(["zone2", "climb_intervals", "threshold_intervals", "vo2_intervals"])
    .nullable(),
  minutes_min: num,
  minutes_max: num,
  structure: z.string().nullable(),
  gate_key: z.string().nullable(),
  is_optional: z.boolean().optional().default(false),
  notes: z.string().nullable(),
});

const loadKind = z.enum(["barbell", "dumbbell", "cuff", "bodyweight", "band"]);

const exerciseRowSchema = z.object({
  id: z.string().uuid(),
  program_session_id: z.string().uuid(),
  exercise_order: z.number(),
  exercise_name: z.string(),
  block_part: z.enum(["legs", "upper"]),
  category: z
    .enum(["main", "accessory", "plyo", "core", "conditioning", "mobility"])
    .nullable()
    .optional()
    .default(null),
  counts_as_quad_set: z.boolean().optional().default(false),
  cue: z.string().nullable().optional().default(null),
  from_week: num,
  until_week: num,
  primary_muscle: z
    .enum(["quads", "hamstrings", "glutes", "calves", "adductors", "core"])
    .nullable(),
  readiness_requirement: z.enum(["any", "normal"]),
  measure: z.enum(["reps", "time", "force", "distance"]),
  side_mode: z.enum(["bilateral", "per_leg", "per_side"]),
  load_kind: loadKind,
  sets_min: num,
  sets_max: num,
  reps_min: num,
  reps_max: num,
  rir_target: num,
  seconds_target: num,
  distance_meters_target: num.optional().default(null),
  tempo: z.string().nullable(),
  gate_key: z.string().nullable(),
  extra_gate_key: z.string().nullable().optional().default(null),
  substitute_name: z.string().nullable(),
  substitute_load_kind: loadKind.nullable(),
  substitute_reps_min: num.optional().default(null),
  substitute_reps_max: num.optional().default(null),
  superset_group: z.string().nullable().optional().default(null),
  superset_order: num.optional().default(null),
  notes: z.string().nullable(),
});

const outcomeRowSchema = z.object({
  id: z.string().uuid(),
  program_session_id: z.string().uuid(),
  outcome_date: z.string(),
  outcome: z.enum(["skipped", "stopped"]),
  reason: z.enum([
    "time",
    "knee",
    "sick",
    "travel",
    "other",
    "giving_way",
    "locking",
    "sharp_pain",
  ]),
  notes: z.string().nullable(),
});

const settingRowSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  value: z.coerce.number().nullable(),
  text_value: z.string().nullable(),
  label: z.string(),
  unit: z.string().nullable(),
  group_name: z.string(),
  sort_order: z.number(),
});

const checkinRowSchema = z.object({
  week_start: z.string(),
  pt_visits_scheduled: num,
  pt_visits_attended: num,
  quad_lsi_pct: z.coerce.number().nullable(),
  walking_asymmetry_pct: z.coerce.number().nullable(),
  notes: z.string().nullable(),
});

const kneeRowSchema = z.object({
  checkin_date: z.string(),
  knee_swelling: z.enum(["none", "trace", "1+", "2+"]).nullable(),
  knee_graft_pain: num,
  knee_extension_full: z.boolean().nullable(),
});

function mapBlock(row: z.infer<typeof blockRowSchema>): ProgramBlock {
  return {
    id: row.id,
    name: row.name,
    startWeek: row.start_week,
    endWeek: row.end_week,
    setsMin: row.sets_min,
    setsMax: row.sets_max,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    rirTarget: row.rir_target,
    repScheme: row.rep_scheme,
    sessionsFromBlockId: row.sessions_from_block_id,
    activation: row.activation,
    gateKey: row.gate_key,
    fallbackBlockId: row.fallback_block_id,
    activatedOn: row.activated_on,
    notes: row.notes,
  };
}

function mapExercise(row: z.infer<typeof exerciseRowSchema>): ProgramExercise {
  return {
    id: row.id,
    sessionId: row.program_session_id,
    order: row.exercise_order,
    name: row.exercise_name,
    blockPart: row.block_part,
    category: row.category,
    countsAsQuadSet: row.counts_as_quad_set,
    cue: row.cue,
    fromWeek: row.from_week,
    untilWeek: row.until_week,
    primaryMuscle: row.primary_muscle,
    readinessRequirement: row.readiness_requirement,
    measure: row.measure,
    sideMode: row.side_mode,
    loadKind: row.load_kind,
    setsMin: row.sets_min,
    setsMax: row.sets_max,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    rirTarget: row.rir_target,
    secondsTarget: row.seconds_target,
    distanceMetersTarget: row.distance_meters_target,
    tempo: row.tempo,
    gateKey: row.gate_key,
    extraGateKey: row.extra_gate_key,
    substituteName: row.substitute_name,
    substituteLoadKind: row.substitute_load_kind,
    substituteRepsMin: row.substitute_reps_min,
    substituteRepsMax: row.substitute_reps_max,
    supersetGroup: row.superset_group,
    supersetOrder: row.superset_order,
    notes: row.notes,
  };
}

function mapSession(
  row: z.infer<typeof sessionRowSchema>,
  exercises: ProgramExercise[],
): ProgramSession {
  return {
    id: row.id,
    blockId: row.block_id,
    dayOfWeek: row.day_of_week,
    sortOrder: row.sort_order,
    sessionType: row.session_type,
    name: row.name,
    upperTemplateId: row.upper_template_id,
    rideKind: row.ride_kind,
    minutesMin: row.minutes_min,
    minutesMax: row.minutes_max,
    structure: row.structure,
    gateKey: row.gate_key,
    isOptional: row.is_optional,
    notes: row.notes,
    exercises,
  };
}

/** PostgREST returns numeric(3,1) as a number, but older drivers send strings. */
function coerceNumerics(rows: unknown[] | null, keys: string[]) {
  return (rows ?? []).map((row) => {
    const copy = { ...(row as Record<string, unknown>) };
    for (const key of keys) {
      if (typeof copy[key] === "string") copy[key] = Number(copy[key]);
    }
    return copy;
  });
}

export class SupabaseProgramRepository implements ProgramRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async getActiveProgram(userId: string): Promise<TrainingProgram | null> {
    const programResponse = await this.client
      .from("training_programs")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    throwOnError(programResponse.error, "Load training program");
    if (!programResponse.data) return null;
    const program = programRowSchema.parse(programResponse.data);

    const [blocksResponse, weeksResponse, gatesResponse] = await Promise.all([
      this.client
        .from("program_blocks")
        .select("*")
        .eq("user_id", userId)
        .eq("program_id", program.id)
        .is("deleted_at", null)
        .order("start_week", { ascending: true }),
      this.client
        .from("program_weeks")
        .select("week_number, is_deload, notes")
        .eq("user_id", userId)
        .eq("program_id", program.id)
        .is("deleted_at", null)
        .order("week_number", { ascending: true }),
      this.client
        .from("program_gates")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);
    throwOnError(blocksResponse.error, "Load program blocks");
    throwOnError(weeksResponse.error, "Load program weeks");
    throwOnError(gatesResponse.error, "Load program gates");

    const blocks = blockRowSchema
      .array()
      .parse(coerceNumerics(blocksResponse.data, ["rir_target"]))
      .map(mapBlock);
    const weeks: ProgramWeek[] = weekRowSchema
      .array()
      .parse(weeksResponse.data ?? [])
      .map((w) => ({
        weekNumber: w.week_number,
        isDeload: w.is_deload,
        notes: w.notes,
      }));
    const gates: ProgramGate[] = gateRowSchema
      .array()
      .parse(gatesResponse.data ?? [])
      .map((g) => ({
        id: g.id,
        gateKey: g.gate_key,
        label: g.label,
        clearedOn: g.cleared_on,
        earliestOn: g.earliest_on,
        notes: g.notes,
      }));

    const blockIds = blocks.map((b) => b.id);
    let sessions: ProgramSession[] = [];
    if (blockIds.length > 0) {
      const sessionsResponse = await this.client
        .from("program_sessions")
        .select("*")
        .eq("user_id", userId)
        .in("block_id", blockIds)
        .is("deleted_at", null)
        .order("day_of_week", { ascending: true })
        .order("sort_order", { ascending: true });
      throwOnError(sessionsResponse.error, "Load program sessions");
      const sessionRows = sessionRowSchema
        .array()
        .parse(sessionsResponse.data ?? []);

      const exercisesBySession = new Map<string, ProgramExercise[]>();
      const sessionIds = sessionRows.map((s) => s.id);
      if (sessionIds.length > 0) {
        const exercisesResponse = await this.client
          .from("program_exercises")
          .select("*")
          .eq("user_id", userId)
          .in("program_session_id", sessionIds)
          .is("deleted_at", null)
          .order("exercise_order", { ascending: true })
          .limit(2000);
        throwOnError(exercisesResponse.error, "Load program exercises");
        exerciseRowSchema
          .array()
          .parse(coerceNumerics(exercisesResponse.data, ["rir_target"]))
          .map(mapExercise)
          .forEach((ex) => {
            exercisesBySession.set(ex.sessionId, [
              ...(exercisesBySession.get(ex.sessionId) ?? []),
              ex,
            ]);
          });
      }
      sessions = sessionRows.map((row) =>
        mapSession(row, exercisesBySession.get(row.id) ?? []),
      );
    }

    return {
      id: program.id,
      userId: program.user_id,
      name: program.name,
      version: program.version ?? null,
      weekAnchorDate: program.week_anchor_date,
      returnToSportWeek: program.return_to_sport_week,
      testDayUrl: program.test_day_url,
      notes: program.notes,
      blocks,
      weeks,
      sessions,
      gates,
    };
  }

  async setGateCleared(input: SetGateClearedInput) {
    const response = await this.client
      .from("program_gates")
      .update({ cleared_on: input.clearedOn })
      .eq("user_id", input.userId)
      .eq("gate_key", input.gateKey)
      .is("deleted_at", null);
    throwOnError(response.error, "Update program gate");
  }

  async listKneeChecks(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DatedKneeCheck[]> {
    const response = await this.client
      .from("recovery_checkins")
      .select(
        "checkin_date, knee_swelling, knee_graft_pain, knee_extension_full",
      )
      .eq("user_id", userId)
      .gte("checkin_date", startDate)
      .lte("checkin_date", endDate)
      .is("deleted_at", null)
      .not("knee_swelling", "is", null)
      .order("checkin_date", { ascending: true });
    throwOnError(response.error, "List knee checks");
    return kneeRowSchema
      .array()
      .parse(response.data ?? [])
      .map((row) => ({
        date: row.checkin_date,
        swelling: row.knee_swelling as KneeSwelling | null,
        graftPain: row.knee_graft_pain,
        extensionFull: row.knee_extension_full,
      }));
  }

  async saveKneeCheck(input: SaveKneeCheckInput) {
    const columns = {
      knee_swelling: input.swelling,
      knee_graft_pain: input.graftPain,
      knee_extension_full: input.extensionFull,
    };
    const existing = await this.client
      .from("recovery_checkins")
      .select("id")
      .eq("user_id", input.userId)
      .eq("checkin_date", input.checkinDate)
      .is("deleted_at", null)
      .maybeSingle();
    throwOnError(existing.error, "Find recovery row for knee check");

    if (existing.data) {
      // Only the three knee columns: synced sleep and vitals stay as they are.
      const response = await this.client
        .from("recovery_checkins")
        .update(columns)
        .eq("id", (existing.data as { id: string }).id)
        .eq("user_id", input.userId);
      throwOnError(response.error, "Save knee check");
      return;
    }

    // No row yet (the overnight sync has not run): start a manual one, which
    // the sleep sync later fills, as the morning "how do you feel" tap does.
    const response = await this.client.from("recovery_checkins").insert({
      user_id: input.userId,
      checkin_date: input.checkinDate,
      alcohol_count: 0,
      source_type: "manual",
      source_provider: null,
      ...columns,
    });
    throwOnError(response.error, "Save knee check");
  }

  async listOutcomes(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<ProgramSessionOutcome[]> {
    const response = await this.client
      .from("program_session_outcomes")
      .select("id, program_session_id, outcome_date, outcome, reason, notes")
      .eq("user_id", userId)
      .gte("outcome_date", startDate)
      .lte("outcome_date", endDate)
      .is("deleted_at", null);
    throwOnError(response.error, "List session outcomes");
    return outcomeRowSchema
      .array()
      .parse(response.data ?? [])
      .map((row) => ({
        id: row.id,
        programSessionId: row.program_session_id,
        date: row.outcome_date,
        outcome: row.outcome,
        reason: row.reason,
        notes: row.notes,
      }));
  }

  async saveOutcome(input: SaveOutcomeInput) {
    const response = await this.client.from("program_session_outcomes").upsert(
      {
        user_id: input.userId,
        program_session_id: input.programSessionId,
        outcome_date: input.date,
        outcome: input.outcome,
        reason: input.reason,
        notes: input.notes ?? null,
        deleted_at: null,
      },
      { onConflict: "user_id,program_session_id,outcome_date" },
    );
    throwOnError(response.error, "Save session outcome");
  }

  async clearOutcome(input: ClearOutcomeInput) {
    const response = await this.client
      .from("program_session_outcomes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", input.userId)
      .eq("program_session_id", input.programSessionId)
      .eq("outcome_date", input.date)
      .is("deleted_at", null);
    throwOnError(response.error, "Clear session outcome");
  }

  async listSettings(userId: string): Promise<TrainingSetting[]> {
    const response = await this.client
      .from("training_settings")
      .select("id, key, value, text_value, label, unit, group_name, sort_order")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("group_name", { ascending: true })
      .order("sort_order", { ascending: true });
    throwOnError(response.error, "List training settings");
    return settingRowSchema
      .array()
      .parse(response.data ?? [])
      .map((row) => ({
        id: row.id,
        key: row.key,
        value: row.value,
        textValue: row.text_value,
        label: row.label,
        unit: row.unit,
        groupName: row.group_name,
        sortOrder: row.sort_order,
      }));
  }

  async updateSetting(input: UpdateSettingInput) {
    const response = await this.client
      .from("training_settings")
      .update({ value: input.value, text_value: input.textValue })
      .eq("user_id", input.userId)
      .eq("key", input.key)
      .is("deleted_at", null);
    throwOnError(response.error, "Update training setting");
  }

  async listWeeklyCheckins(
    userId: string,
    fromWeekStart: string,
    toWeekStart: string,
  ): Promise<ProgramWeeklyCheckin[]> {
    const response = await this.client
      .from("program_weekly_checkins")
      .select(
        "week_start, pt_visits_scheduled, pt_visits_attended, quad_lsi_pct, walking_asymmetry_pct, notes",
      )
      .eq("user_id", userId)
      .gte("week_start", fromWeekStart)
      .lte("week_start", toWeekStart)
      .is("deleted_at", null)
      .order("week_start", { ascending: true });
    throwOnError(response.error, "List weekly check-ins");
    return checkinRowSchema
      .array()
      .parse(response.data ?? [])
      .map((row) => ({
        weekStart: row.week_start,
        ptVisitsScheduled: row.pt_visits_scheduled,
        ptVisitsAttended: row.pt_visits_attended,
        quadLsiPct: row.quad_lsi_pct,
        walkingAsymmetryPct: row.walking_asymmetry_pct,
        notes: row.notes,
      }));
  }

  async saveWeeklyCheckin(input: SaveWeeklyCheckinInput) {
    const response = await this.client.from("program_weekly_checkins").upsert(
      {
        user_id: input.userId,
        week_start: input.weekStart,
        pt_visits_scheduled: input.ptVisitsScheduled,
        pt_visits_attended: input.ptVisitsAttended,
        quad_lsi_pct: input.quadLsiPct,
        walking_asymmetry_pct: input.walkingAsymmetryPct,
        notes: input.notes,
        deleted_at: null,
      },
      { onConflict: "user_id,week_start" },
    );
    throwOnError(response.error, "Save weekly check-in");
  }
}
