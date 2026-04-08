import type { ImportBatch } from "@fitness-app/domain";
import { z } from "zod";
import {
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

const importBatchRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  integration_connection_id: z.string().uuid().nullable(),
  provider: z.enum(["withings", "peloton", "strava", "apple_health"]),
  batch_type: z.string(),
  status: z.enum(["received", "processing", "processed", "partially_processed", "failed"]),
  provider_cursor: z.string().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  raw_item_count: z.number().int(),
  processed_item_count: z.number().int(),
  failed_item_count: z.number().int(),
  error_summary: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});

function mapImportBatchRow(row: z.infer<typeof importBatchRowSchema>): ImportBatch {
  return {
    id: row.id,
    userId: row.user_id,
    integrationConnectionId: row.integration_connection_id,
    provider: row.provider,
    batchType: row.batch_type,
    status: row.status,
    providerCursor: row.provider_cursor,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    rawItemCount: row.raw_item_count,
    processedItemCount: row.processed_item_count,
    failedItemCount: row.failed_item_count,
    errorSummary: row.error_summary,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseImportBatchRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async listRecentImportBatches(userId: string, limit: number) {
    const response = await this.client
      .from("import_batches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwOnError(response.error, "List import batches");

    return importBatchRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapImportBatchRow);
  }

  async create(input: {
    userId: string;
    integrationConnectionId: string;
    provider: "withings" | "peloton" | "strava" | "apple_health";
    batchType: string;
    providerCursor: string | null;
    metadata: Record<string, unknown>;
  }) {
    const response = await this.client
      .from("import_batches")
      .insert({
        user_id: input.userId,
        integration_connection_id: input.integrationConnectionId,
        provider: input.provider,
        batch_type: input.batchType,
        status: "received",
        provider_cursor: input.providerCursor,
        metadata: input.metadata,
      })
      .select("*")
      .single();

    return mapImportBatchRow(
      importBatchRowSchema.parse(
        requireSingleResult(response, "Create import batch"),
      ),
    );
  }

  async markProcessing(id: string) {
    const response = await this.client
      .from("import_batches")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", id);

    throwOnError(response.error, "Mark import batch processing");
  }

  async markProcessed(
    id: string,
    input: {
      nextCursor: string | null;
      rawItemCount: number;
      processedItemCount: number;
      failedItemCount: number;
      metadata: Record<string, unknown>;
    },
  ) {
    const response = await this.client
      .from("import_batches")
      .update({
        status: input.failedItemCount > 0 ? "partially_processed" : "processed",
        provider_cursor: input.nextCursor,
        raw_item_count: input.rawItemCount,
        processed_item_count: input.processedItemCount,
        failed_item_count: input.failedItemCount,
        metadata: input.metadata,
        finished_at: new Date().toISOString(),
        error_summary:
          input.failedItemCount > 0
            ? `${input.failedItemCount} import items failed to map.`
            : null,
      })
      .eq("id", id);

    throwOnError(response.error, "Mark import batch processed");
  }

  async markFailed(
    id: string,
    errorSummary: string,
    counts: {
      rawItemCount: number;
      processedItemCount: number;
      failedItemCount: number;
    },
  ) {
    const response = await this.client
      .from("import_batches")
      .update({
        status: "failed",
        raw_item_count: counts.rawItemCount,
        processed_item_count: counts.processedItemCount,
        failed_item_count: counts.failedItemCount,
        error_summary: errorSummary,
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);

    throwOnError(response.error, "Mark import batch failed");
  }
}
