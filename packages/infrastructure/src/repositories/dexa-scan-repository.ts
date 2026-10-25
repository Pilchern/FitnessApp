import {
  DEXA_MEASUREMENT_KEYS,
  type DexaMeasurementKey,
  type DexaScan,
} from "@fitness-app/domain";
import type {
  DexaScanRepository,
  SaveDexaScanInput,
} from "@fitness-app/application";
import { z } from "zod";
import {
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

/** `legsLeanLb` -> `legs_lean_lb`; `vatIn3` -> `vat_in3`. */
export function dexaColumn(key: DexaMeasurementKey) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

// numeric columns come back from PostgREST as numbers or strings.
const numeric = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((v) => (v == null ? null : Number(v)));

const dexaRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  scan_date: z.string(),
  facility: z.string().nullable(),
  machine: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const measurementRowSchema = z.object(
  Object.fromEntries(
    DEXA_MEASUREMENT_KEYS.map((k) => [dexaColumn(k), numeric]),
  ) as Record<string, typeof numeric>,
);

function mapRow(row: Record<string, unknown>): DexaScan {
  const parsed = dexaRowSchema.parse(row);
  const values = measurementRowSchema.parse(row);
  const measurements = Object.fromEntries(
    DEXA_MEASUREMENT_KEYS.map((k) => [k, values[dexaColumn(k)] ?? null]),
  ) as Record<DexaMeasurementKey, number | null>;
  return {
    ...measurements,
    id: parsed.id,
    userId: parsed.user_id,
    scanDate: parsed.scan_date,
    facility: parsed.facility,
    machine: parsed.machine,
    notes: parsed.notes,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };
}

export class SupabaseDexaScanRepository implements DexaScanRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async save(input: SaveDexaScanInput) {
    const values: Record<string, unknown> = {
      facility: input.facility || null,
      machine: input.machine || null,
      notes: input.notes || null,
    };
    for (const key of DEXA_MEASUREMENT_KEYS) {
      values[dexaColumn(key)] = input[key];
    }

    // One live scan per date: replace it if present (partial unique index,
    // so no PostgREST upsert).
    const existing = await this.client
      .from("dexa_scans")
      .select("id")
      .eq("user_id", input.userId)
      .eq("scan_date", input.scanDate)
      .is("deleted_at", null)
      .maybeSingle();
    throwOnError(existing.error, "Find DEXA scan");

    const response = existing.data
      ? await this.client
          .from("dexa_scans")
          .update(values)
          .eq("id", existing.data.id)
          .eq("user_id", input.userId)
          .select("*")
          .single()
      : await this.client
          .from("dexa_scans")
          .insert({
            ...values,
            user_id: input.userId,
            scan_date: input.scanDate,
          })
          .select("*")
          .single();

    return mapRow(requireSingleResult(response, "Save DEXA scan"));
  }

  async list(userId: string) {
    const response = await this.client
      .from("dexa_scans")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("scan_date", { ascending: true })
      .limit(200);
    throwOnError(response.error, "List DEXA scans");
    return (response.data ?? []).map((row) => mapRow(row));
  }
}
