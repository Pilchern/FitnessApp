import { z } from "zod";

const parseBooleanCheckbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "");

function parseOptionalNumber(schema: z.ZodNumber, fieldName: string) {
  return optionalString.transform((value, ctx) => {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a number`,
      });
      return z.NEVER;
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error.issues[0]?.message ?? `${fieldName} is invalid`,
      });
      return z.NEVER;
    }

    return parsed;
  });
}

export const nutritionLogFormSchema = z.object({
  id: optionalString,
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proteinHit: parseBooleanCheckbox,
  mealsOnPlan: parseBooleanCheckbox,
  noPostDinnerSnacking: parseBooleanCheckbox,
  junkLeakage: parseBooleanCheckbox,
  fiberTaken: parseBooleanCheckbox,
  alcoholCount: parseOptionalNumber(
    z.number().int().min(0).max(50),
    "Alcohol count",
  ).transform((value) => value ?? 0),
  notes: optionalString,
});

export type NutritionLogFormInput = z.infer<typeof nutritionLogFormSchema>;
