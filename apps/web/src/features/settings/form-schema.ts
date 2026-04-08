import { z } from "zod";

function parseOptionalPositiveInt(fieldName: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} must be a positive whole number`,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

export const settingsFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(100, "Display name must be 100 characters or fewer"),
  timezone: z.string().min(1, "Timezone is required"),
  unitsSystem: z.enum(["imperial", "metric"], {
    message: "Units system must be imperial or metric",
  }),
  weekStartsOn: z
    .enum(["0", "1"], { message: "Week start must be 0 (Sunday) or 1 (Monday)" })
    .transform((value) => Number(value) as 0 | 1),
  goalFatLoss: z.boolean(),
  goalPreserveMuscle: z.boolean(),
  goalImproveVo2: z.boolean(),
  dailyProteinGramsTarget: parseOptionalPositiveInt("Daily protein target"),
  dailyCaloriesTarget: parseOptionalPositiveInt("Daily calories target"),
  dailyFiberGramsTarget: parseOptionalPositiveInt("Daily fiber target"),
});

export type SettingsFormInput = z.infer<typeof settingsFormSchema>;
