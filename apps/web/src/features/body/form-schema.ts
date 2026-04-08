import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

export const bodyMetricFormSchema = z.object({
  id: optionalString,
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightLb: parseOptionalNumber(z.number().positive(), "Weight"),
  waistIn: parseOptionalNumber(z.number().positive(), "Waist"),
  bodyFatPct: parseOptionalNumber(z.number().min(0).max(100), "Body fat"),
  muscleMassLb: parseOptionalNumber(z.number().min(0), "Muscle mass"),
  sourceType: z.literal("manual"),
  notes: optionalString,
});

export type BodyMetricFormInput = z.infer<typeof bodyMetricFormSchema>;
