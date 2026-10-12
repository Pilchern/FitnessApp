import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

export const bodyMetricFormSchema = z.object({
  id: optionalString,
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  waistIn: parseOptionalNumber(z.number().positive().max(120), "Waist"),
  waistHipIn: parseOptionalNumber(z.number().positive().max(120), "Hip waist"),
  waistGutIn: parseOptionalNumber(z.number().positive().max(120), "Gut waist"),
  sourceType: z.literal("manual"),
  notes: optionalString,
});

export type BodyMetricFormInput = z.infer<typeof bodyMetricFormSchema>;
