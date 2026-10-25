import type { NutritionLog } from "@fitness-app/domain";
import type {
  CreateNutritionLogInput,
  NutritionLogDateRangeQuery,
  NutritionLogRepository,
  UpdateNutritionLogInput,
} from "@fitness-app/application";
import { DEFAULT_DATE_RANGE_QUERY_LIMIT } from "@fitness-app/application";
import { z } from "zod";
import {
  compactRecord,
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

const nutritionLogRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  log_date: z.string(),
  protein_hit: z.boolean().nullable(),
  meals_on_plan: z.boolean().nullable(),
  no_post_dinner_snacking: z.boolean().nullable(),
  junk_leakage: z.boolean().nullable(),
  fiber_taken: z.boolean().nullable(),
  alcohol_count: z.number().int(),
  // Optional so rows read before the Phase B migration still parse.
  protein_grams: z.number().int().nullable().optional(),
  calories: z.number().int().nullable().optional(),
  creatine_taken: z.boolean().nullable().optional(),
  protein_50_by_9am: z.boolean().nullable().optional(),
  net_carbs_grams: z.number().int().nullable().optional(),
  fat_grams: z.number().int().nullable().optional(),
  fiber_grams: z.number().int().nullable().optional(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type NutritionLogRow = z.infer<typeof nutritionLogRowSchema>;

function mapRow(row: NutritionLogRow): NutritionLog {
  return {
    id: row.id,
    userId: row.user_id,
    logDate: row.log_date,
    proteinHit: row.protein_hit,
    mealsOnPlan: row.meals_on_plan,
    noPostDinnerSnacking: row.no_post_dinner_snacking,
    junkLeakage: row.junk_leakage,
    fiberTaken: row.fiber_taken,
    alcoholCount: row.alcohol_count,
    proteinGrams: row.protein_grams ?? null,
    calories: row.calories ?? null,
    creatineTaken: row.creatine_taken ?? null,
    protein50By9am: row.protein_50_by_9am ?? null,
    netCarbsGrams: row.net_carbs_grams ?? null,
    fatGrams: row.fat_grams ?? null,
    fiberGrams: row.fiber_grams ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toInsert(input: CreateNutritionLogInput) {
  return {
    user_id: input.userId,
    log_date: input.logDate,
    protein_hit: input.proteinHit ?? null,
    meals_on_plan: input.mealsOnPlan ?? null,
    no_post_dinner_snacking: input.noPostDinnerSnacking ?? null,
    junk_leakage: input.junkLeakage ?? null,
    fiber_taken: input.fiberTaken ?? null,
    alcohol_count: input.alcoholCount,
    notes: input.notes ?? null,
    // Only sent when set, so logs save before the Phase B columns exist.
    ...(input.proteinGrams != null
      ? { protein_grams: input.proteinGrams }
      : {}),
    ...(input.calories != null ? { calories: input.calories } : {}),
    ...(input.creatineTaken != null
      ? { creatine_taken: input.creatineTaken }
      : {}),
    ...(input.protein50By9am != null
      ? { protein_50_by_9am: input.protein50By9am }
      : {}),
    ...(input.netCarbsGrams != null
      ? { net_carbs_grams: input.netCarbsGrams }
      : {}),
    ...(input.fatGrams != null ? { fat_grams: input.fatGrams } : {}),
    ...(input.fiberGrams != null ? { fiber_grams: input.fiberGrams } : {}),
  };
}

function toUpdate(input: UpdateNutritionLogInput) {
  return compactRecord({
    log_date: input.logDate,
    protein_hit: input.proteinHit,
    meals_on_plan: input.mealsOnPlan,
    no_post_dinner_snacking: input.noPostDinnerSnacking,
    junk_leakage: input.junkLeakage,
    fiber_taken: input.fiberTaken,
    alcohol_count: input.alcoholCount,
    protein_grams: input.proteinGrams,
    calories: input.calories,
    creatine_taken: input.creatineTaken,
    protein_50_by_9am: input.protein50By9am,
    net_carbs_grams: input.netCarbsGrams,
    fat_grams: input.fatGrams,
    fiber_grams: input.fiberGrams,
    notes: input.notes,
  });
}

export class SupabaseNutritionLogRepository implements NutritionLogRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async create(input: CreateNutritionLogInput) {
    const response = await this.client
      .from("nutrition_logs")
      .insert(toInsert(input))
      .select("*")
      .single();

    return mapRow(
      nutritionLogRowSchema.parse(
        requireSingleResult(response, "Create nutrition log"),
      ),
    );
  }

  async update(input: UpdateNutritionLogInput) {
    const response = await this.client
      .from("nutrition_logs")
      .update(toUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    return mapRow(
      nutritionLogRowSchema.parse(
        requireSingleResult(response, "Update nutrition log"),
      ),
    );
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("nutrition_logs")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch nutrition log");

    return response.data
      ? mapRow(nutritionLogRowSchema.parse(response.data))
      : null;
  }

  async archive(userId: string, id: string) {
    const response = await this.client
      .from("nutrition_logs")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive nutrition log");
  }

  async listByDateRange(query: NutritionLogDateRangeQuery) {
    let request = this.client
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", query.userId)
      .is("deleted_at", null)
      .order("log_date", { ascending: false })
      .limit(query.limit ?? DEFAULT_DATE_RANGE_QUERY_LIMIT);

    if (query.startDate) {
      request = request.gte("log_date", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("log_date", query.endDate);
    }

    const response = await request;
    throwOnError(response.error, "List nutrition logs");

    return nutritionLogRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapRow);
  }
}
