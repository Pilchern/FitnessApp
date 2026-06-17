import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

const templateExerciseSchema = z.object({
  name: z.string().min(1).max(100),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.string().max(20).optional(),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(500).optional(),
});

export const templateExercisesSchema = z.array(templateExerciseSchema).min(1).max(50);

const parsedStrengthSetSchema = z.object({
  exerciseName: z.string().trim().min(1, "Exercise name is required"),
  setNumber: z.number().int().min(1),
  reps: parseOptionalNumber(z.number().int().min(0), "Reps"),
  weight: parseOptionalNumber(z.number().min(0), "Weight"),
  rir: parseOptionalNumber(z.number().min(0).max(6), "RIR"),
  notes: optionalString,
});

export const strengthSessionFormSchema = z.object({
  id: optionalString,
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionName: optionalString,
  notes: optionalString,
  durationMinutes: parseOptionalNumber(z.number().int().min(0), "Duration"),
  readinessPre: parseOptionalNumber(z.number().int().min(1).max(10), "Readiness"),
  energyPost: parseOptionalNumber(z.number().int().min(1).max(10), "Energy"),
  completedAsPlanned: z.enum(["true", "false"]).transform((value) => value === "true"),
  setsPayload: optionalString.transform((value, ctx) => {
    try {
      const parsed = JSON.parse(value || "[]");
      return z
        .array(parsedStrengthSetSchema)
        .min(1, "Add at least one exercise set before saving.")
        .parse(parsed);
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("at least one")
          ? err.message
          : "Exercise sets could not be read. Please try again.";
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
      });
      return z.NEVER;
    }
  }),
});

export type StrengthSessionFormInput = z.infer<typeof strengthSessionFormSchema>;
