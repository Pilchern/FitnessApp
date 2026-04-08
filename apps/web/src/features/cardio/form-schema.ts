import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

export const cardioSessionFormSchema = z.object({
  id: optionalString,
  trainingTemplateId: optionalString,
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionKind: z.enum(["zone2", "vo2", "recovery", "other"]),
  plannedVsCompleted: z.enum(["planned", "completed", "partial", "skipped"]),
  durationMinutes: parseOptionalNumber(z.number().int().min(0), "Duration"),
  avgHeartRate: parseOptionalNumber(z.number().int().min(0), "Average heart rate"),
  maxHeartRate: parseOptionalNumber(z.number().int().min(0), "Max heart rate"),
  avgOutput: parseOptionalNumber(z.number().min(0), "Average output"),
  cadenceMin: parseOptionalNumber(z.number().int().min(0), "Cadence min"),
  cadenceMax: parseOptionalNumber(z.number().int().min(0), "Cadence max"),
  resistanceMin: parseOptionalNumber(z.number().min(0), "Resistance min"),
  resistanceMax: parseOptionalNumber(z.number().min(0), "Resistance max"),
  intervalStructure: optionalString,
  rpe: parseOptionalNumber(z.number().min(1).max(10), "RPE"),
  notes: optionalString,
});

export type CardioSessionFormInput = z.infer<typeof cardioSessionFormSchema>;
