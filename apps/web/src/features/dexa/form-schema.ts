import { DEXA_FIELDS } from "@fitness-app/application";
import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

/** Form fields: the date, the text fields and one optional number per report value. */
export const dexaScanFormSchema = z.object({
  scanDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the scan date"),
  facility: optionalString,
  machine: optionalString,
  notes: optionalString,
  ...Object.fromEntries(
    DEXA_FIELDS.map((f) => [
      f.key,
      parseOptionalNumber(
        z
          .number()
          .min(f.min, `${f.label} must be at least ${f.min}`)
          .max(f.max, `${f.label} must be at most ${f.max}`),
        f.label,
      ),
    ]),
  ),
});

export function readDexaForm(formData: FormData) {
  const raw: Record<string, FormDataEntryValue | null> = {
    scanDate: formData.get("scanDate"),
    facility: formData.get("facility"),
    machine: formData.get("machine"),
    notes: formData.get("notes"),
  };
  for (const f of DEXA_FIELDS) raw[f.key] = formData.get(f.key);
  const parsed = dexaScanFormSchema.parse(raw) as Record<string, unknown> & {
    scanDate: string;
    facility: string;
    machine: string;
    notes: string;
  };
  return {
    ...parsed,
    facility: parsed.facility || null,
    machine: parsed.machine || null,
    notes: parsed.notes || null,
  };
}
