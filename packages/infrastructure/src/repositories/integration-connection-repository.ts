import type { IntegrationConnection } from "@fitness-app/domain";
import { z } from "zod";
import {
  type AppSupabaseClient,
  compactRecord,
  requireSingleResult,
  throwOnError,
} from "./shared";

const integrationConnectionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: z.enum(["withings", "peloton", "strava", "apple_health"]),
  status: z.enum(["active", "reauth_required", "paused", "error", "disconnected"]),
  account_label: z.string().nullable(),
  provider_user_id: z.string().nullable(),
  scopes: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  last_synced_at: z.string().nullable(),
  last_cursor: z.string().nullable(),
  last_successful_batch_id: z.string().uuid().nullable(),
  last_error: z.string().nullable(),
  last_failed_at: z.string().nullable(),
  last_failure_code: z.string().nullable(),
  last_failure_message: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  connected_at: z.string().nullable(),
  disconnected_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type IntegrationConnectionRow = z.infer<typeof integrationConnectionRowSchema>;

function mapIntegrationConnectionRow(row: IntegrationConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    status: row.status,
    accountLabel: row.account_label,
    providerUserId: row.provider_user_id,
    scopes: row.scopes,
    capabilities: row.capabilities,
    lastSyncedAt: row.last_synced_at,
    lastCursor: row.last_cursor,
    lastSuccessfulBatchId: row.last_successful_batch_id,
    lastError: row.last_error,
    lastFailedAt: row.last_failed_at,
    lastFailureCode: row.last_failure_code,
    lastFailureMessage: row.last_failure_message,
    metadata: row.metadata,
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SupabaseIntegrationConnectionRepository
{
  constructor(private readonly client: AppSupabaseClient) {}

  async listConnections(userId: string) {
    const response = await this.client
      .from("integration_connections")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("provider", { ascending: true });

    throwOnError(response.error, "List integration connections");

    return integrationConnectionRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapIntegrationConnectionRow);
  }

  async getByUserAndProvider(userId: string, provider: "withings" | "peloton" | "strava" | "apple_health") {
    const response = await this.client
      .from("integration_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch integration connection");

    return response.data
      ? mapIntegrationConnectionRow(integrationConnectionRowSchema.parse(response.data))
      : null;
  }

  async saveConnection(
    input: {
      userId: string;
      provider: "withings" | "peloton" | "strava" | "apple_health";
      accountLabel: string | null;
      providerUserId: string | null;
      scopes: string[];
      capabilities: string[];
      metadata: Record<string, unknown>;
      status: IntegrationConnection["status"];
    },
  ) {
    const existing = await this.getByUserAndProvider(input.userId, input.provider);
    const payload = {
      user_id: input.userId,
      provider: input.provider,
      status: input.status,
      account_label: input.accountLabel,
      provider_user_id: input.providerUserId,
      scopes: input.scopes,
      capabilities: input.capabilities,
      metadata: input.metadata,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      deleted_at: null,
      last_error: null,
      last_failed_at: null,
      last_failure_code: null,
      last_failure_message: null,
    };

    if (existing) {
      const response = await this.client
        .from("integration_connections")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      return mapIntegrationConnectionRow(
        integrationConnectionRowSchema.parse(
          requireSingleResult(response, "Update integration connection"),
        ),
      );
    }

    const response = await this.client
      .from("integration_connections")
      .insert(payload)
      .select("*")
      .single();

    return mapIntegrationConnectionRow(
      integrationConnectionRowSchema.parse(
        requireSingleResult(response, "Create integration connection"),
      ),
    );
  }

  async recordSyncSuccess(input: {
    id: string;
    lastSyncedAt: string;
    lastCursor: string | null;
    lastSuccessfulBatchId: string;
    accountLabel?: string | null;
  }) {
    const response = await this.client
      .from("integration_connections")
      .update(
        compactRecord({
          status: "active",
          last_synced_at: input.lastSyncedAt,
          last_cursor: input.lastCursor,
          last_successful_batch_id: input.lastSuccessfulBatchId,
          last_error: null,
          last_failed_at: null,
          last_failure_code: null,
          last_failure_message: null,
          account_label: input.accountLabel,
        }),
      )
      .eq("id", input.id)
      .select("*")
      .single();

    return mapIntegrationConnectionRow(
      integrationConnectionRowSchema.parse(
        requireSingleResult(response, "Record integration sync success"),
      ),
    );
  }

  async recordSyncFailure(input: {
    id: string;
    errorCode: string;
    errorMessage: string;
  }) {
    const response = await this.client
      .from("integration_connections")
      .update({
        status: "error",
        last_error: input.errorMessage,
        last_failed_at: new Date().toISOString(),
        last_failure_code: input.errorCode,
        last_failure_message: input.errorMessage,
      })
      .eq("id", input.id)
      .select("*")
      .single();

    return mapIntegrationConnectionRow(
      integrationConnectionRowSchema.parse(
        requireSingleResult(response, "Record integration sync failure"),
      ),
    );
  }

  async disconnect(userId: string, provider: "withings" | "peloton" | "strava" | "apple_health") {
    const response = await this.client
      .from("integration_connections")
      .update({
        status: "disconnected",
        disconnected_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", provider)
      .is("deleted_at", null);

    throwOnError(response.error, "Disconnect integration connection");
  }
}
