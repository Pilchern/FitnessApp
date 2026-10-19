import { z } from "zod";
import {
  dateRangeQuerySchema,
  ensureAtLeastOneDefined,
  isoDateSchema,
  optionalTrimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";

const nutritionLogBaseSchema = z.object({
  logDate: isoDateSchema,
  proteinHit: z.boolean().nullable().optional(),
  mealsOnPlan: z.boolean().nullable().optional(),
  noPostDinnerSnacking: z.boolean().nullable().optional(),
  junkLeakage: z.boolean().nullable().optional(),
  fiberTaken: z.boolean().nullable().optional(),
  alcoholCount: z.number().int().min(0).max(50).default(0),
  proteinGrams: z.number().int().min(0).max(500).nullable().optional(),
  calories: z.number().int().min(0).max(10000).nullable().optional(),
  creatineTaken: z.boolean().nullable().optional(),
  protein50By9am: z.boolean().nullable().optional(),
  notes: optionalTrimmedStringSchema,
});

export const createNutritionLogSchema = nutritionLogBaseSchema.extend({
  userId: uuidSchema,
});

export const updateNutritionLogSchema = nutritionLogBaseSchema
  .partial()
  .extend({
    id: uuidSchema,
    userId: uuidSchema,
  })
  .refine(
    (value) =>
      ensureAtLeastOneDefined(value, [
        "logDate",
        "proteinHit",
        "mealsOnPlan",
        "noPostDinnerSnacking",
        "junkLeakage",
        "fiberTaken",
        "alcoholCount",
        "proteinGrams",
        "calories",
        "creatineTaken",
        "protein50By9am",
        "notes",
      ]),
    {
      message: "At least one field must be provided for update",
    },
  );

export const nutritionLogDateRangeQuerySchema = dateRangeQuerySchema;

export type CreateNutritionLogInput = z.infer<typeof createNutritionLogSchema>;
export type UpdateNutritionLogInput = z.infer<typeof updateNutritionLogSchema>;
export type NutritionLogDateRangeQuery = z.infer<
  typeof nutritionLogDateRangeQuerySchema
>;
