import type {
  EntityId,
  UserId,
  WeeklyReview,
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

const weeklyReviewSummarySchema = z.object({
  averageWeightLb: z.number().nullable().optional(),
  waistIn: z.number().nullable().optional(),
  liftsCompleted: z.number().int().nullable().optional(),
  ridesCompleted: z.number().int().nullable().optional(),
  zone2Minutes: z.number().int().nullable().optional(),
  vo2Completed: z.boolean().nullable().optional(),
  sleepAverageHours: z.number().nullable().optional(),
  alcoholTotal: z.number().int().nullable().optional(),
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

const weeklyReviewScoreDetailsSchema: z.ZodType<WeeklyReviewScoreDetails> = z.object({
  version: z.literal("v1"),
  totalScore: z.number().int().min(0).max(100),
  band: z.enum(["strong", "solid", "fragile"]),
  components: weeklyReviewScoreComponentSchema.array(),
});

const weeklyReviewManualOverridesSchema: z.ZodType<WeeklyReviewManualOverrides> = z.object({
  averageWeightLb: z.boolean().optional(),
  waistIn: z.boolean().optional(),
  liftsCompleted: z.boolean().optional(),
  ridesCompleted: z.boolean().optional(),
  zone2Minutes: z.boolean().optional(),
  vo2Completed: z.boolean().optional(),
  sleepAverageHours: z.boolean().optional(),
  alcoholTotal: z.boolean().optional(),
});

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
        !value.status || value.status !== "completed" || value.completedAt != null,
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
    return this.repository.findByWeekStart(weeklyReviewLookupSchema.parse(input));
  }

  async getLatest(userId: string) {
    return this.repository.findLatest(userId);
  }

  async listRecent(userId: string, limit?: number) {
    return this.repository.listRecent(userId, limit);
  }
}
