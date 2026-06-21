import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

const weeklyReviewManualOverridesFormSchema = z.object({
  averageWeightLb: z.boolean().optional(),
  waistIn: z.boolean().optional(),
  liftsCompleted: z.boolean().optional(),
  ridesCompleted: z.boolean().optional(),
  zone2Minutes: z.boolean().optional(),
  vo2Completed: z.boolean().optional(),
  sleepAverageHours: z.boolean().optional(),
  alcoholTotal: z.boolean().optional(),
  averageReadiness: z.boolean().optional(),
});

export const weeklyReviewFormSchema = z.object({
  id: optionalString,
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  averageWeightLb: parseOptionalNumber(z.number().positive(), "Average weight"),
  waistIn: parseOptionalNumber(z.number().positive(), "Waist"),
  liftsCompleted: parseOptionalNumber(z.number().int().min(0).max(14), "Lifts completed"),
  ridesCompleted: parseOptionalNumber(z.number().int().min(0).max(14), "Rides completed"),
  zone2Minutes: parseOptionalNumber(z.number().int().min(0).max(2000), "Zone 2 minutes"),
  vo2Completed: z.enum(["true", "false"]),
  sleepAverageHours: parseOptionalNumber(z.number().min(0).max(24), "Sleep average"),
  alcoholTotal: parseOptionalNumber(z.number().int().min(0).max(99), "Alcohol total"),
  bestWin: optionalString,
  biggestMiss: optionalString,
  lesson: optionalString,
  nextWeekPriority: optionalString,
  confidence: parseOptionalNumber(z.number().int().min(1).max(10), "Confidence"),
  manualOverrides: optionalString.transform((value, ctx) => {
    if (!value) {
      return {};
    }

    try {
      return weeklyReviewManualOverridesFormSchema.parse(JSON.parse(value));
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Manual override markers are invalid",
      });
      return z.NEVER;
    }
  }),
});

export type WeeklyReviewFormInput = z.infer<typeof weeklyReviewFormSchema>;
