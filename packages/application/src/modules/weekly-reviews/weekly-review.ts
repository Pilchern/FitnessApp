import type {
  EntityId,
  UserId,
  WeeklyReview,
  WeeklyReviewAiDraft,
  WeeklyReviewManualOverrides,
  WeeklyReviewScoreDetails,
  WeeklyReviewSummary,
} from "@fitness-app/domain";
import { z } from "zod";
import {
  ensureAtLeastOneDefined,
  isoDateSchema,
  isoDateTimeSchema,
  optionalTrimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";

// Upper bounds are data-entry sanity checks matching the equivalent web-form
// bounds (weekly-review/form-schema.ts) — this summary is user-editable via
// manualOverrides, so it needs the same protection as the source data it
// otherwise mirrors (body-metric, cardio, recovery).
const weeklyReviewSummarySchema = z.object({
  averageWeightLb: z.number().positive().max(1000).nullable().optional(),
  waistIn: z.number().positive().max(120).nullable().optional(),
  liftsCompleted: z.number().int().min(0).max(14).nullable().optional(),
  ridesCompleted: z.number().int().min(0).max(14).nullable().optional(),
  zone2Minutes: z.number().int().min(0).max(2000).nullable().optional(),
  vo2Completed: z.boolean().nullable().optional(),
  sleepAverageHours: z.number().min(0).max(24).nullable().optional(),
  alcoholTotal: z.number().int().min(0).max(99).nullable().optional(),
});

const weeklyReviewScoreComponentSchema = z.object({
  key: z.enum([
    "lifts",
    "rides",
    "zone2",
    "vo2",
    "sleep",
    "alcohol",
    "confidence",
  ]),
  label: z.string(),
  score: z.number().int().min(0),
  maxScore: z.number().int().positive(),
  detail: z.string(),
});

const weeklyReviewScoreDetailsSchema: z.ZodType<WeeklyReviewScoreDetails> =
  z.object({
    version: z.literal("v1"),
    totalScore: z.number().int().min(0).max(100),
    band: z.enum(["strong", "solid", "fragile"]),
    components: weeklyReviewScoreComponentSchema.array(),
  });

const weeklyReviewManualOverridesSchema: z.ZodType<WeeklyReviewManualOverrides> =
  z.object({
    averageWeightLb: z.boolean().optional(),
    waistIn: z.boolean().optional(),
    liftsCompleted: z.boolean().optional(),
    ridesCompleted: z.boolean().optional(),
    zone2Minutes: z.boolean().optional(),
    vo2Completed: z.boolean().optional(),
    sleepAverageHours: z.boolean().optional(),
    alcoholTotal: z.boolean().optional(),
  });

export const weeklyReviewAiDraftSchema: z.ZodType<WeeklyReviewAiDraft> =
  z.object({
    score: z.number().int().min(1).max(100),
    scoreRationale: z.string(),
    whatWorked: z.string(),
    whatNeedsAttention: z.string(),
    strategicDecision: z.string(),
    riskForecast: z.string(),
    nextBestAction: z.string(),
    model: z.string(),
    generatedAt: isoDateTimeSchema,
  });

const weeklyReviewAiDraftStatusSchema = z.enum([
  "none",
  "pending_review",
  "accepted",
  "dismissed",
]);

const weeklyReviewFields = {
  weekStart: isoDateSchema,
  weekEnd: isoDateSchema,
  status: z.enum(["draft", "completed"]),
  summary: weeklyReviewSummarySchema.default({}),
  bestWin: optionalTrimmedStringSchema,
  biggestMiss: optionalTrimmedStringSchema,
  lesson: optionalTrimmedStringSchema,
  nextWeekPriority: optionalTrimmedStringSchema,
  confidence: z.number().int().min(1).max(10).nullable().optional(),
  scoreDetails: weeklyReviewScoreDetailsSchema.nullable().optional(),
  strategicDecision: optionalTrimmedStringSchema,
  riskForecast: optionalTrimmedStringSchema,
  manualOverrides: weeklyReviewManualOverridesSchema.default({}),
  aiDraft: weeklyReviewAiDraftSchema.nullable().optional(),
  aiDraftStatus: weeklyReviewAiDraftStatusSchema.default("none"),
  completedAt: isoDateTimeSchema.nullable().optional(),
} satisfies z.ZodRawShape;

function withWeeklyReviewRules<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (value: z.infer<T>) => {
        if (!value.weekStart || !value.weekEnd) {
          return true;
        }

        const start = new Date(`${value.weekStart}T00:00:00.000Z`);
        const end = new Date(`${value.weekEnd}T00:00:00.000Z`);
        const differenceInDays =
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        return differenceInDays === 6;
      },
      {
        message: "weekEnd must be exactly six days after weekStart",
        path: ["weekEnd"],
      },
    )
    .refine(
      (value: z.infer<T>) =>
        !value.status ||
        value.status !== "completed" ||
        value.completedAt != null,
      {
        message: "completedAt is required when the review is completed",
        path: ["completedAt"],
      },
    );
}

export const createWeeklyReviewSchema = withWeeklyReviewRules(
  z.object({
    userId: uuidSchema,
    ...weeklyReviewFields,
  }),
);

export const updateWeeklyReviewSchema = withWeeklyReviewRules(
  z
    .object({
      id: uuidSchema,
      userId: uuidSchema,
      weekStart: isoDateSchema.optional(),
      weekEnd: isoDateSchema.optional(),
      status: z.enum(["draft", "completed"]).optional(),
      summary: weeklyReviewSummarySchema.optional(),
      bestWin: optionalTrimmedStringSchema,
      biggestMiss: optionalTrimmedStringSchema,
      lesson: optionalTrimmedStringSchema,
      nextWeekPriority: optionalTrimmedStringSchema,
      confidence: z.number().int().min(1).max(10).nullable().optional(),
      scoreDetails: weeklyReviewScoreDetailsSchema.nullable().optional(),
      strategicDecision: optionalTrimmedStringSchema,
      riskForecast: optionalTrimmedStringSchema,
      manualOverrides: weeklyReviewManualOverridesSchema.optional(),
      aiDraft: weeklyReviewAiDraftSchema.nullable().optional(),
      aiDraftStatus: weeklyReviewAiDraftStatusSchema.optional(),
      completedAt: isoDateTimeSchema.nullable().optional(),
    })
    .refine(
      (value) =>
        ensureAtLeastOneDefined(value, [
          "weekStart",
          "weekEnd",
          "status",
          "summary",
          "bestWin",
          "biggestMiss",
          "lesson",
          "nextWeekPriority",
          "confidence",
          "scoreDetails",
          "strategicDecision",
          "riskForecast",
          "manualOverrides",
          "aiDraft",
          "aiDraftStatus",
          "completedAt",
        ]),
      {
        message: "At least one field must be provided for update",
      },
    ),
);

export const weeklyReviewLookupSchema = z.object({
  userId: uuidSchema,
  weekStart: isoDateSchema,
});

export type CreateWeeklyReviewInput = z.infer<typeof createWeeklyReviewSchema>;
export type UpdateWeeklyReviewInput = z.infer<typeof updateWeeklyReviewSchema>;
export type WeeklyReviewLookup = z.infer<typeof weeklyReviewLookupSchema>;

export interface WeeklyReviewRepository {
  create(input: CreateWeeklyReviewInput): Promise<WeeklyReview>;
  update(input: UpdateWeeklyReviewInput): Promise<WeeklyReview>;
  findById(userId: UserId, id: EntityId): Promise<WeeklyReview | null>;
  findByWeekStart(query: WeeklyReviewLookup): Promise<WeeklyReview | null>;
  findLatest(userId: UserId): Promise<WeeklyReview | null>;
  listRecent(userId: UserId, limit?: number): Promise<WeeklyReview[]>;
}

export class WeeklyReviewService {
  constructor(private readonly repository: WeeklyReviewRepository) {}

  async create(input: unknown) {
    return this.repository.create(createWeeklyReviewSchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateWeeklyReviewSchema.parse(input));
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async getByWeekStart(input: unknown) {
    return this.repository.findByWeekStart(
      weeklyReviewLookupSchema.parse(input),
    );
  }

  async getLatest(userId: string) {
    return this.repository.findLatest(userId);
  }

  async listRecent(userId: string, limit?: number) {
    return this.repository.listRecent(userId, limit);
  }

  /** Persists a freshly generated AI draft and marks it awaiting user review. */
  async saveAiDraft(userId: string, id: string, aiDraft: WeeklyReviewAiDraft) {
    return this.update({
      userId,
      id,
      aiDraft,
      aiDraftStatus: "pending_review",
    });
  }

  /**
   * Marks the AI draft as accepted. This does NOT copy the draft's content
   * into the canonical bestWin/biggestMiss/strategicDecision/riskForecast
   * columns — that only happens when the user submits the normal manual
   * save action (see mapAiDraftToManualFields + the weekly-review UI, which
   * pre-fills the edit form from the accepted draft).
   */
  async acceptAiDraft(userId: string, id: string) {
    return this.update({ userId, id, aiDraftStatus: "accepted" });
  }

  /** Discards the AI draft; the manual flow proceeds with nothing pre-filled. */
  async dismissAiDraft(userId: string, id: string) {
    return this.update({ userId, id, aiDraftStatus: "dismissed" });
  }
}
