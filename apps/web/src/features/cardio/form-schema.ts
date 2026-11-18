import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

export const cardioSessionFormSchema = z.object({
  id: optionalString,
  trainingTemplateId: optionalString,
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionKind: z.enum(["zone2", "vo2", "recovery", "other"]),
  plannedVsCompleted: z.enum(["planned", "completed", "partial", "skipped"]),
  durationMinutes: parseOptionalNumber(z.number().int().min(0), "Duration"),
  avgHeartRate: parseOptionalNumber(
    z.number().int().min(0).max(250),
    "Average heart rate",
  ),
  maxHeartRate: parseOptionalNumber(
    z.number().int().min(0).max(250),
    "Max heart rate",
  ),
  avgOutput: parseOptionalNumber(z.number().min(0), "Average output"),
  intervalOutput1: parseOptionalNumber(
    z.number().int().min(0).max(2000),
    "Interval 1 output",
  ),
  intervalOutput2: parseOptionalNumber(
    z.number().int().min(0).max(2000),
    "Interval 2 output",
  ),
  intervalOutput3: parseOptionalNumber(
    z.number().int().min(0).max(2000),
    "Interval 3 output",
  ),
  intervalOutput4: parseOptionalNumber(
    z.number().int().min(0).max(2000),
    "Interval 4 output",
  ),
  runMinutes: parseOptionalNumber(z.number().min(0).max(600), "Run minutes"),
  walkMinutes: parseOptionalNumber(z.number().min(0).max(600), "Walk minutes"),
  totalOutputKj: parseOptionalNumber(
    z.number().min(0).max(5000),
    "Total output",
  ),
  cadenceMin: parseOptionalNumber(z.number().int().min(0), "Cadence min"),
  cadenceMax: parseOptionalNumber(z.number().int().min(0), "Cadence max"),
  resistanceMin: parseOptionalNumber(z.number().min(0), "Resistance min"),
  resistanceMax: parseOptionalNumber(z.number().min(0), "Resistance max"),
  intervalStructure: optionalString,
  rpe: parseOptionalNumber(z.number().min(1).max(10), "RPE"),
  notes: optionalString,
});

export type CardioSessionFormInput = z.infer<typeof cardioSessionFormSchema>;
