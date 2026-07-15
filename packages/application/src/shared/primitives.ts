import { z } from "zod";
import { MANUAL_RECORD_SOURCE } from "@fitness-app/domain";

export const uuidSchema = z.string().uuid();

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date in YYYY-MM-DD format");

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime());

export const optionalIsoDateTimeSchema = isoDateTimeSchema.nullable().optional();

export const trimmedStringSchema = z.string().trim().min(1);

export const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional();

export const nullableNumberSchema = z.number().finite().nullable().optional();

// Local wall-clock time (no date/timezone component), matching how a
// Postgres `time` column round-trips through supabase-js. Accepts "HH:MM"
// (the shape the web form submits) and "HH:MM:SS" (the shape returned when
// reading a `time` column back from the database).
export const localTimeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    "Expected a 24-hour clock time in HH:MM format",
  );

export const optionalLocalTimeSchema = localTimeSchema.nullable().optional();

export const manualRecordSourceSchema = z.object({
  sourceType: z.literal("manual"),
  sourceProvider: z.null().default(null),
  sourceExternalId: z.null().default(null),
  importBatchId: z.null().default(null),
  rawImportEventId: z.null().default(null),
});

export const importedRecordSourceSchema = z.object({
  sourceType: z.literal("imported"),
  sourceProvider: trimmedStringSchema,
  sourceExternalId: trimmedStringSchema.nullable().default(null),
  importBatchId: uuidSchema.nullable().default(null),
  rawImportEventId: uuidSchema.nullable().default(null),
});

export const mixedRecordSourceSchema = z.object({
  sourceType: z.literal("mixed"),
  sourceProvider: trimmedStringSchema,
  sourceExternalId: trimmedStringSchema.nullable().default(null),
  importBatchId: uuidSchema.nullable().default(null),
  rawImportEventId: uuidSchema.nullable().default(null),
});

export const manualOrImportedRecordSourceSchema = z.discriminatedUnion(
  "sourceType",
  [manualRecordSourceSchema, importedRecordSourceSchema],
);

export const canonicalRecordSourceSchema = z.discriminatedUnion("sourceType", [
  manualRecordSourceSchema,
  importedRecordSourceSchema,
  mixedRecordSourceSchema,
]);

export const defaultManualSource = () => MANUAL_RECORD_SOURCE;

export const dateRangeQuerySchema = z
  .object({
    userId: uuidSchema,
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  })
  .refine(
    (value) => !value.startDate || !value.endDate || value.startDate <= value.endDate,
    {
      message: "startDate must be less than or equal to endDate",
      path: ["endDate"],
    },
  );

export function ensureAtLeastOneDefined<T extends Record<string, unknown>>(
  value: T,
  keys: Array<keyof T>,
) {
  return keys.some((key) => value[key] !== undefined);
}
