import type {
  CardioSession,
  CardioSessionCompletion,
  CardioSessionKind,
  EntityId,
  UserId,
} from "@fitness-app/domain";
import { z } from "zod";
import {
  dateRangeQuerySchema,
  defaultManualSource,
  ensureAtLeastOneDefined,
  isoDateSchema,
  isoDateTimeSchema,
  manualOrImportedRecordSourceSchema,
  optionalTrimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";
import {
  type CrossProviderDecision,
  decideCardioCrossProvider,
} from "../integrations/cross-provider-dedup";

/**
 * Shifts a `YYYY-MM-DD` string by whole days. Anchored at midday UTC so a
 * daylight-saving transition can't push the result onto the wrong date.
 */
function shiftIsoDate(isoDate: string, days: number): string {
  const anchored = new Date(`${isoDate}T12:00:00.000Z`);
  anchored.setUTCDate(anchored.getUTCDate() + days);
  return anchored.toISOString().slice(0, 10);
}

const cardioSessionKindSchema = z.enum(["zone2", "vo2", "recovery", "other"]);
const cardioSessionCompletionSchema = z.enum([
  "planned",
  "completed",
  "partial",
  "skipped",
]);

const cardioSessionFields = {
  trainingTemplateId: uuidSchema.nullable().optional(),
  sessionDate: isoDateSchema,
  startedAt: isoDateTimeSchema.nullable().optional(),
  endedAt: isoDateTimeSchema.nullable().optional(),
  sessionKind: cardioSessionKindSchema,
  plannedVsCompleted: cardioSessionCompletionSchema.default("completed"),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  zone2Minutes: z.number().int().min(0).nullable().optional(),
  // Upper bound is a data-entry sanity check (well above any real human heart
  // rate, including extreme training outliers), not a physiological limit.
  avgHeartRate: z.number().int().min(0).max(250).nullable().optional(),
  maxHeartRate: z.number().int().min(0).max(250).nullable().optional(),
  avgOutput: z.number().nonnegative().nullable().optional(),
  cadenceMin: z.number().int().min(0).nullable().optional(),
  cadenceMax: z.number().int().min(0).nullable().optional(),
  resistanceMin: z.number().nonnegative().nullable().optional(),
  resistanceMax: z.number().nonnegative().nullable().optional(),
  intervalStructure: optionalTrimmedStringSchema,
  rpe: z.number().min(1).max(10).nullable().optional(),
  distanceMeters: z.number().nonnegative().nullable().optional(),
  notes: optionalTrimmedStringSchema,
  source: manualOrImportedRecordSourceSchema.default(defaultManualSource),
} satisfies z.ZodRawShape;

function withCardioSessionRules<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (value: z.infer<T>) =>
        !value.startedAt ||
        !value.endedAt ||
        new Date(value.startedAt).getTime() <=
          new Date(value.endedAt).getTime(),
      {
        message: "endedAt must be after startedAt",
        path: ["endedAt"],
      },
    )
    .refine(
      (value: z.infer<T>) =>
        value.durationMinutes == null ||
        value.zone2Minutes == null ||
        value.zone2Minutes <= value.durationMinutes,
      {
        message: "zone2Minutes cannot exceed durationMinutes",
        path: ["zone2Minutes"],
      },
    )
    .refine(
      (value: z.infer<T>) =>
        value.cadenceMin == null ||
        value.cadenceMax == null ||
        value.cadenceMin <= value.cadenceMax,
      {
        message: "cadenceMin cannot exceed cadenceMax",
        path: ["cadenceMax"],
      },
    )
    .refine(
      (value: z.infer<T>) =>
        value.resistanceMin == null ||
        value.resistanceMax == null ||
        value.resistanceMin <= value.resistanceMax,
      {
        message: "resistanceMin cannot exceed resistanceMax",
        path: ["resistanceMax"],
      },
    );
}

export const createCardioSessionSchema = withCardioSessionRules(
  z.object({
    userId: uuidSchema,
    ...cardioSessionFields,
    sportType: z.string().nullable().optional(),
  }),
);

export const updateCardioSessionSchema = withCardioSessionRules(
  z
    .object({
      id: uuidSchema,
      userId: uuidSchema,
      trainingTemplateId: uuidSchema.nullable().optional(),
      sessionDate: isoDateSchema.optional(),
      startedAt: isoDateTimeSchema.nullable().optional(),
      endedAt: isoDateTimeSchema.nullable().optional(),
      sessionKind: cardioSessionKindSchema.optional(),
      plannedVsCompleted: cardioSessionCompletionSchema.optional(),
      durationMinutes: z.number().int().min(0).nullable().optional(),
      zone2Minutes: z.number().int().min(0).nullable().optional(),
      avgHeartRate: z.number().int().min(0).max(250).nullable().optional(),
      maxHeartRate: z.number().int().min(0).max(250).nullable().optional(),
      avgOutput: z.number().nonnegative().nullable().optional(),
      cadenceMin: z.number().int().min(0).nullable().optional(),
      cadenceMax: z.number().int().min(0).nullable().optional(),
      resistanceMin: z.number().nonnegative().nullable().optional(),
      resistanceMax: z.number().nonnegative().nullable().optional(),
      intervalStructure: optionalTrimmedStringSchema,
      rpe: z.number().min(1).max(10).nullable().optional(),
      distanceMeters: z.number().nonnegative().nullable().optional(),
      notes: optionalTrimmedStringSchema,
      source: manualOrImportedRecordSourceSchema.optional(),
    })
    .refine(
      (value) =>
        ensureAtLeastOneDefined(value, [
          "trainingTemplateId",
          "sessionDate",
          "startedAt",
          "endedAt",
          "sessionKind",
          "plannedVsCompleted",
          "durationMinutes",
          "zone2Minutes",
          "avgHeartRate",
          "maxHeartRate",
          "avgOutput",
          "cadenceMin",
          "cadenceMax",
          "resistanceMin",
          "resistanceMax",
          "intervalStructure",
          "rpe",
          "distanceMeters",
          "notes",
          "source",
        ]),
      {
        message: "At least one field must be provided for update",
      },
    ),
);

export const cardioSessionDateRangeQuerySchema = dateRangeQuerySchema;

export type CreateCardioSessionInput = z.infer<
  typeof createCardioSessionSchema
>;
export type UpdateCardioSessionInput = z.infer<
  typeof updateCardioSessionSchema
>;
export type CardioSessionDateRangeQuery = z.infer<
  typeof cardioSessionDateRangeQuerySchema
>;

export type CardioSessionListItemDto = {
  id: EntityId;
  sessionDate: string;
  sessionKind: CardioSessionKind;
  plannedVsCompleted: CardioSessionCompletion;
  durationMinutes: number | null;
  avgHeartRate: number | null;
  notes: string | null;
};

export interface CardioSessionRepository {
  create(input: CreateCardioSessionInput): Promise<CardioSession>;
  update(input: UpdateCardioSessionInput): Promise<CardioSession>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<CardioSession | null>;
  findByExternalId(
    userId: UserId,
    sourceProvider: string,
    sourceExternalId: string,
  ): Promise<CardioSession | null>;
  /**
   * Same lookup as `findByExternalId`, but for soft-deleted rows only.
   *
   * Needed because `cardio_sessions_external_id_dedup_idx` is NOT predicated
   * on `deleted_at is null` (unlike its sibling
   * `cardio_sessions_provider_external_unique_idx`), so a tombstone still
   * occupies its slot in that index. Without this check, re-importing an
   * external id that cross-provider dedup previously archived would fall
   * through to `create` and hit a unique-constraint violation on every sync.
   */
  findArchivedByExternalId(
    userId: UserId,
    sourceProvider: string,
    sourceExternalId: string,
  ): Promise<CardioSession | null>;
  listByDateRange(query: CardioSessionDateRangeQuery): Promise<CardioSession[]>;
}

export class CardioSessionService {
  constructor(private readonly repository: CardioSessionRepository) {}

  async create(input: unknown) {
    return this.repository.create(createCardioSessionSchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateCardioSessionSchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async listByDateRange(input: unknown) {
    return this.repository.listByDateRange(
      cardioSessionDateRangeQuerySchema.parse(input),
    );
  }

  /**
   * Inserts an imported cardio session, skipping it when the same real-world
   * workout is already stored.
   *
   * Two checks run, in order:
   *
   * 1. **Same provider** — a row with the same
   *    `(userId, sourceProvider, sourceExternalId)` is a straight re-import;
   *    the existing row is returned untouched.
   * 2. **Cross-provider (TD-019)** — the same ride can arrive from two
   *    different providers with different external ids, so neither the unique
   *    index nor check 1 catches it. Every session already stored for that
   *    calendar day is compared against the incoming one; on a match the
   *    higher-priority source wins. See `cross-provider-dedup.ts` for the
   *    matching rules and the priority order.
   *
   * When the incoming session wins, the superseded row is archived — a soft
   * delete, so nothing is unrecoverable if the heuristic ever gets it wrong.
   */
  async upsertImported(
    userId: string,
    session: Omit<CreateCardioSessionInput, "userId">,
  ): Promise<{
    created: boolean;
    session: CardioSession;
    crossProvider?: CrossProviderDecision;
  }> {
    const source = session.source as
      | { sourceProvider?: string; sourceExternalId?: string }
      | undefined;
    const sourceProvider = source?.sourceProvider ?? null;
    const sourceExternalId = source?.sourceExternalId ?? null;

    if (sourceProvider && sourceExternalId) {
      const existing = await this.repository.findByExternalId(
        userId,
        sourceProvider,
        sourceExternalId,
      );
      if (existing) {
        return { created: false, session: existing };
      }

      // A tombstone for this external id still occupies a slot in
      // `cardio_sessions_external_id_dedup_idx`, which has no `deleted_at`
      // predicate. Falling through to `create` here would violate that
      // constraint on every sync, forever. Returning the tombstone also
      // preserves the user's intent when they deleted the row themselves,
      // matching how the body-metric repository already behaves.
      const archived = await this.repository.findArchivedByExternalId(
        userId,
        sourceProvider,
        sourceExternalId,
      );
      if (archived) {
        return { created: false, session: archived };
      }
    }

    const parsed = createCardioSessionSchema.parse({ userId, ...session });

    // Deliberately +/- one day rather than the session's own date. The three
    // cardio importers derive sessionDate in different timezones (Strava and
    // Peloton from UTC, the Apple Health bridge from a local timestamp), so
    // the same ride can be filed under two adjacent dates -- and a workout
    // that straddles midnight lands on two dates for any single provider.
    // Matching then happens on `startedAt`, which is an absolute instant.
    const nearbyExisting = await this.repository.listByDateRange({
      userId,
      startDate: shiftIsoDate(parsed.sessionDate, -1),
      endDate: shiftIsoDate(parsed.sessionDate, 1),
    });
    const decision = decideCardioCrossProvider(
      {
        sessionDate: parsed.sessionDate,
        startedAt: parsed.startedAt ?? null,
        durationMinutes: parsed.durationMinutes ?? null,
        sportType: parsed.sportType ?? null,
        source: parsed.source,
      },
      nearbyExisting,
    );

    if (decision.outcome === "skip_incoming") {
      const winner = nearbyExisting.find(
        (candidate) => candidate.id === decision.duplicateOf,
      );
      // `duplicateOf` always names a member of the list the decision was made
      // from, so this fallback is unreachable in practice — it exists so a
      // future refactor of the lookup can't turn a miss into a crash.
      if (winner) {
        return { created: false, session: winner, crossProvider: decision };
      }
    }

    const created = await this.repository.create(parsed);

    if (decision.outcome === "supersede_existing") {
      await this.repository.archive(userId, decision.duplicateOf);
    }

    return { created: true, session: created, crossProvider: decision };
  }

  async listListItemsByDateRange(
    input: unknown,
  ): Promise<CardioSessionListItemDto[]> {
    const sessions = await this.listByDateRange(input);

    return sessions.map((session) => ({
      id: session.id,
      sessionDate: session.sessionDate,
      sessionKind: session.sessionKind,
      plannedVsCompleted: session.plannedVsCompleted,
      durationMinutes: session.durationMinutes,
      avgHeartRate: session.avgHeartRate,
      notes: session.notes,
    }));
  }
}
