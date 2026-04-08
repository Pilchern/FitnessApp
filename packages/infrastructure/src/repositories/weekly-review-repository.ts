import type {
  WeeklyReview,
  WeeklyReviewManualOverrides,
  WeeklyReviewScoreDetails,
  WeeklyReviewSummary,
} from "@fitness-app/domain";
import type {
  CreateWeeklyReviewInput,
  UpdateWeeklyReviewInput,
  WeeklyReviewLookup,
  WeeklyReviewRepository,
} from "@fitness-app/application";
import { z } from "zod";
import {
  compactRecord,
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

const weeklyReviewSummaryRowSchema: z.ZodType<WeeklyReviewSummary> = z.object({
  averageWeightLb: z.number().nullable().optional(),
  waistIn: z.number().nullable().optional(),
  liftsCompleted: z.number().int().nullable().optional(),
  ridesCompleted: z.number().int().nullable().optional(),
  zone2Minutes: z.number().int().nullable().optional(),
  vo2Completed: z.boolean().nullable().optional(),
  sleepAverageHours: z.number().nullable().optional(),
  alcoholTotal: z.number().int().nullable().optional(),
});

const weeklyReviewScoreDetailsRowSchema: z.ZodType<WeeklyReviewScoreDetails> = z.object({
  version: z.literal("v1"),
  totalScore: z.number().int(),
  band: z.enum(["strong", "solid", "fragile"]),
  components: z.array(
    z.object({
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
      score: z.number().int(),
      maxScore: z.number().int(),
      detail: z.string(),
    }),
  ),
});

const weeklyReviewManualOverridesRowSchema: z.ZodType<WeeklyReviewManualOverrides> = z.object({
  averageWeightLb: z.boolean().optional(),
  waistIn: z.boolean().optional(),
  liftsCompleted: z.boolean().optional(),
  ridesCompleted: z.boolean().optional(),
  zone2Minutes: z.boolean().optional(),
  vo2Completed: z.boolean().optional(),
  sleepAverageHours: z.boolean().optional(),
  alcoholTotal: z.boolean().optional(),
});

const weeklyReviewRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  week_start: z.string(),
  week_end: z.string(),
  status: z.enum(["draft", "completed"]),
  summary: weeklyReviewSummaryRowSchema,
  best_win: z.string().nullable(),
  biggest_miss: z.string().nullable(),
  lesson: z.string().nullable(),
  next_week_priority: z.string().nullable(),
  confidence: z.number().int().nullable(),
  score_details: z.union([weeklyReviewScoreDetailsRowSchema, z.object({})]),
  strategic_decision: z.string().nullable(),
  risk_forecast: z.string().nullable(),
  manual_overrides: weeklyReviewManualOverridesRowSchema,
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type WeeklyReviewRow = z.infer<typeof weeklyReviewRowSchema>;

export function mapWeeklyReviewRow(row: WeeklyReviewRow): WeeklyReview {
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    status: row.status,
    summary: row.summary,
    bestWin: row.best_win,
    biggestMiss: row.biggest_miss,
    lesson: row.lesson,
    nextWeekPriority: row.next_week_priority,
    confidence: row.confidence,
    scoreDetails: "version" in row.score_details ? row.score_details : null,
    strategicDecision: row.strategic_decision,
    riskForecast: row.risk_forecast,
    manualOverrides: row.manual_overrides,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toWeeklyReviewInsert(input: CreateWeeklyReviewInput) {
  return {
    user_id: input.userId,
    week_start: input.weekStart,
    week_end: input.weekEnd,
    status: input.status,
    summary: input.summary,
    best_win: input.bestWin ?? null,
    biggest_miss: input.biggestMiss ?? null,
    lesson: input.lesson ?? null,
    next_week_priority: input.nextWeekPriority ?? null,
    confidence: input.confidence ?? null,
    score_details: input.scoreDetails ?? {},
    strategic_decision: input.strategicDecision ?? null,
    risk_forecast: input.riskForecast ?? null,
    manual_overrides: input.manualOverrides ?? {},
    completed_at: input.completedAt ?? null,
  };
}

function toWeeklyReviewUpdate(input: UpdateWeeklyReviewInput) {
  return compactRecord({
    week_start: input.weekStart,
    week_end: input.weekEnd,
    status: input.status,
    summary: input.summary,
    best_win: input.bestWin,
    biggest_miss: input.biggestMiss,
    lesson: input.lesson,
    next_week_priority: input.nextWeekPriority,
    confidence: input.confidence,
    score_details: input.scoreDetails,
    strategic_decision: input.strategicDecision,
    risk_forecast: input.riskForecast,
    manual_overrides: input.manualOverrides,
    completed_at: input.completedAt,
  });
}

export class SupabaseWeeklyReviewRepository implements WeeklyReviewRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async create(input: CreateWeeklyReviewInput) {
    const response = await this.client
      .from("weekly_reviews")
      .insert(toWeeklyReviewInsert(input))
      .select("*")
      .single();

    return mapWeeklyReviewRow(
      weeklyReviewRowSchema.parse(
        requireSingleResult(response, "Create weekly review"),
      ),
    );
  }

  async update(input: UpdateWeeklyReviewInput) {
    const response = await this.client
      .from("weekly_reviews")
      .update(toWeeklyReviewUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    return mapWeeklyReviewRow(
      weeklyReviewRowSchema.parse(
        requireSingleResult(response, "Update weekly review"),
      ),
    );
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("weekly_reviews")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch weekly review");

    return response.data
      ? mapWeeklyReviewRow(weeklyReviewRowSchema.parse(response.data))
      : null;
  }

  async findByWeekStart(query: WeeklyReviewLookup) {
    const response = await this.client
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", query.userId)
      .eq("week_start", query.weekStart)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch weekly review by week");

    return response.data
      ? mapWeeklyReviewRow(weeklyReviewRowSchema.parse(response.data))
      : null;
  }

  async findLatest(userId: string) {
    const response = await this.client
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    throwOnError(response.error, "Fetch latest weekly review");

    return response.data
      ? mapWeeklyReviewRow(weeklyReviewRowSchema.parse(response.data))
      : null;
  }

  async listRecent(userId: string, limit = 8) {
    const response = await this.client
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("week_start", { ascending: false })
      .limit(limit);

    throwOnError(response.error, "List recent weekly reviews");

    return weeklyReviewRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapWeeklyReviewRow);
  }
}
