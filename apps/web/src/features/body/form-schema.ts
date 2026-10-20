import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

export const bodyMetricFormSchema = z.object({
  id: optionalString,
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  waistIn: parseOptionalNumber(z.number().positive().max(120), "Waist"),
  waistHipIn: parseOptionalNumber(z.number().positive().max(120), "Hip waist"),
  waistGutIn: parseOptionalNumber(z.number().positive().max(120), "Gut waist"),
  // DEXA results typed in from the scan report. Lean mass is entered in lb
  // and stored as fat-free mass (lb and kg), like the Withings import.
  bodyFatPct: parseOptionalNumber(
    z
      .number()
      .min(3, "Body fat must be between 3 and 60%")
      .max(60, "Body fat must be between 3 and 60%"),
    "Body fat",
  ),
  leanMassLb: parseOptionalNumber(
    z
      .number()
      .min(60, "Lean mass must be between 60 and 300 lb")
      .max(300, "Lean mass must be between 60 and 300 lb"),
    "Lean mass",
  ),
  sourceType: z.literal("manual"),
  notes: optionalString,
});

export type BodyMetricFormInput = z.infer<typeof bodyMetricFormSchema>;
