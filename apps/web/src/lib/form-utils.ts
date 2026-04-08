import { z } from "zod";

export const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "");

/**
 * Parses an optional numeric field from FormData.
 * Accepts string, number, null, or undefined — returns number | null.
 * Validates the parsed value against the provided Zod number schema.
 */
export function parseOptionalNumber(schema: z.ZodNumber, fieldName: string) {
  return z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((value, ctx) => {
    if (value == null || value === "") {
      return null;
    }

    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a number`,
      });
      return z.NEVER;
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error.issues[0]?.message ?? `${fieldName} is invalid`,
      });
      return z.NEVER;
    }

    return parsed;
  });
}
