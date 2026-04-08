type CreateRawImportEventInput = {
  userId: string;
  importBatchId: string;
  integrationConnectionId: string;
  provider: "withings" | "peloton" | "strava" | "apple_health";
  providerEventType: string;
  providerExternalId: string;
  eventOccurredAt: string | null;
  payload: Record<string, unknown>;
};

type StoredRawImportEvent = {
  id: string;
  providerExternalId: string;
  eventOccurredAt: string | null;
  payload: Record<string, unknown>;
};
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

const rawImportEventRowSchema = z.object({
  id: z.string().uuid(),
  provider_external_id: z.string().nullable(),
  event_occurred_at: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
});

type RawImportEventRow = z.infer<typeof rawImportEventRowSchema>;

function payloadHash(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export class SupabaseRawImportEventRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async createMany(inputs: CreateRawImportEventInput[]): Promise<StoredRawImportEvent[]> {
    const created: RawImportEventRow[] = [];

    for (const input of inputs) {
      const insertPayload = {
        user_id: input.userId,
        import_batch_id: input.importBatchId,
        integration_connection_id: input.integrationConnectionId,
        provider: input.provider,
        provider_event_type: input.providerEventType,
        provider_external_id: input.providerExternalId,
        event_occurred_at: input.eventOccurredAt,
        payload: input.payload,
        payload_hash: payloadHash(input.payload),
        mapping_status: "pending",
      };

      const insertResponse = await this.client
        .from("raw_import_events")
        .insert(insertPayload)
        .select("id, provider_external_id, event_occurred_at, payload")
        .maybeSingle();

      if (insertResponse.error?.code === "23505") {
        const existingResponse = await this.client
          .from("raw_import_events")
          .select("id, provider_external_id, event_occurred_at, payload")
          .eq("user_id", input.userId)
          .eq("provider", input.provider)
          .eq("provider_external_id", input.providerExternalId)
          .eq("payload_hash", payloadHash(input.payload))
          .single();

        created.push(
          rawImportEventRowSchema.parse(
            requireSingleResult(existingResponse, "Fetch existing raw import event"),
          ),
        );

        continue;
      }

      created.push(
        rawImportEventRowSchema.parse(
          requireSingleResult(insertResponse, "Create raw import event"),
        ),
      );
    }

    return created.map((row) => ({
      id: row.id,
      providerExternalId: row.provider_external_id ?? "unknown",
      eventOccurredAt: row.event_occurred_at,
      payload: row.payload,
    }));
  }

  async markMapped(
    id: string,
    target: { canonicalTargetTable: string; canonicalTargetId: string },
  ) {
    const response = await this.client
      .from("raw_import_events")
      .update({
        mapping_status: "mapped",
        mapping_error: null,
        canonical_target_table: target.canonicalTargetTable,
        canonical_target_id: target.canonicalTargetId,
      })
      .eq("id", id);

    throwOnError(response.error, "Mark raw import event mapped");
  }

  async markSkipped(id: string) {
    const response = await this.client
      .from("raw_import_events")
      .update({
        mapping_status: "skipped",
      })
      .eq("id", id);

    throwOnError(response.error, "Mark raw import event skipped");
  }

  async markFailed(id: string, errorMessage: string) {
    const response = await this.client
      .from("raw_import_events")
      .update({
        mapping_status: "failed",
        mapping_error: errorMessage,
      })
      .eq("id", id);

    throwOnError(response.error, "Mark raw import event failed");
  }
}
