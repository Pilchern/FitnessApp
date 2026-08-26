import type { Supplement } from "@fitness-app/domain";
import type {
  CreateSupplementInput,
  SupplementRepository,
  UpdateSupplementInput,
} from "@fitness-app/application";
import { z } from "zod";
import {
  compactRecord,
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

const supplementRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type SupplementRow = z.infer<typeof supplementRowSchema>;

export function mapSupplementRow(row: SupplementRow): Supplement {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toSupplementInsert(input: CreateSupplementInput) {
  return {
    user_id: input.userId,
    name: input.name,
    is_active: true,
  };
}

function toSupplementUpdate(input: UpdateSupplementInput) {
  return compactRecord({
    name: input.name,
    is_active: input.isActive,
  });
}

export class SupabaseSupplementRepository implements SupplementRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async create(input: CreateSupplementInput) {
    const response = await this.client
      .from("supplements")
      .insert(toSupplementInsert(input))
      .select("*")
      .single();

    return mapSupplementRow(
      supplementRowSchema.parse(
        requireSingleResult(response, "Create supplement"),
      ),
    );
  }

  async update(input: UpdateSupplementInput) {
    const response = await this.client
      .from("supplements")
      .update(toSupplementUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    return mapSupplementRow(
      supplementRowSchema.parse(
        requireSingleResult(response, "Update supplement"),
      ),
    );
  }

  /**
   * "Archive" here means deactivate (is_active = false), not soft-delete —
   * this preserves historical supplement_logs rows and lets the supplement
   * still be shown in past adherence data. It mirrors how
   * TrainingTemplateService.archiveTemplate() flips is_archived rather than
   * setting deleted_at.
   */
  async archive(userId: string, id: string) {
    const response = await this.client
      .from("supplements")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive supplement");
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("supplements")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch supplement");

    return response.data
      ? mapSupplementRow(supplementRowSchema.parse(response.data))
      : null;
  }

  async listAll(userId: string) {
    const response = await this.client
      .from("supplements")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    throwOnError(response.error, "List supplements");

    return supplementRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapSupplementRow);
  }

  async listActive(userId: string) {
    const response = await this.client
      .from("supplements")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    throwOnError(response.error, "List active supplements");

    return supplementRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapSupplementRow);
  }
}
