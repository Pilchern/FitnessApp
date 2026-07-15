import { z } from "zod";
import {
  dateRangeQuerySchema,
  ensureAtLeastOneDefined,
  isoDateSchema,
  trimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";

export const createSupplementSchema = z.object({
  userId: uuidSchema,
  name: trimmedStringSchema.max(100),
});

export const updateSupplementSchema = z
  .object({
    id: uuidSchema,
    userId: uuidSchema,
    name: trimmedStringSchema.max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => ensureAtLeastOneDefined(value, ["name", "isActive"]), {
    message: "At least one field must be provided for update",
  });

export const listSupplementsQuerySchema = z.object({
  userId: uuidSchema,
});

export type CreateSupplementInput = z.infer<typeof createSupplementSchema>;
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;
export type ListSupplementsQuery = z.infer<typeof listSupplementsQuerySchema>;

export const logSupplementAdherenceSchema = z.object({
  userId: uuidSchema,
  supplementId: uuidSchema,
  logDate: isoDateSchema,
  taken: z.boolean(),
});

export const supplementLogDateRangeQuerySchema = dateRangeQuerySchema;

export const supplementLogByDateQuerySchema = z.object({
  userId: uuidSchema,
  logDate: isoDateSchema,
});

export type LogSupplementAdherenceInput = z.infer<
  typeof logSupplementAdherenceSchema
>;
export type SupplementLogDateRangeQuery = z.infer<
  typeof supplementLogDateRangeQuerySchema
>;
export type SupplementLogByDateQuery = z.infer<
  typeof supplementLogByDateQuerySchema
>;
