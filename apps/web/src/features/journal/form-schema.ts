import { z } from "zod";
import { optionalString } from "@/lib/form-utils";

function parseOptionalUuid(fieldName: string) {
  return optionalString.transform((value, ctx) => {
    if (!value) {
      return null;
    }

    const result = z.string().uuid().safeParse(value);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a valid id`,
      });
      return z.NEVER;
    }

    return value;
  });
}

export const journalEntryFormSchema = z.object({
  id: optionalString,
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: optionalString,
  body: z.string().trim().min(1, "Body is required"),
  tags: optionalString.transform((value) =>
    value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  ),
  relatedWeekStart: optionalString.transform((value, ctx) => {
    if (!value) {
      return null;
    }

    const result = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(value);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Related week must be a valid date",
      });
      return z.NEVER;
    }

    return value;
  }),
  relatedCardioSessionId: parseOptionalUuid("Related cardio session"),
  relatedStrengthSessionId: parseOptionalUuid("Related strength session"),
});

export type JournalEntryFormInput = z.infer<typeof journalEntryFormSchema>;
