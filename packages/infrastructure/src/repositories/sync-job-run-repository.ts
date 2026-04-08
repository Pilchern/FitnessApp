import type { SyncJobRun } from "@fitness-app/domain";
import { z } from "zod";
import {
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

const syncJobRunRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  integration_connection_id: z.string().uuid().nullable(),
  job_type: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  trigger_type: z.enum(["scheduled", "manual", "retry", "system", "webhook"]),
  dedupe_key: z.string().nullable(),
  attempt_count: z.number().int(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  scheduled_for: z.string().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
  result: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});

function mapSyncJobRunRow(row: z.infer<typeof syncJobRunRowSchema>): SyncJobRun {
  return {
    id: row.id,
    userId: row.user_id,
    integrationConnectionId: row.integration_connection_id,
    jobType: row.job_type,
    status: row.status,
    triggerType: row.trigger_type,
    dedupeKey: row.dedupe_key,
    attemptCount: row.attempt_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    scheduledFor: row.scheduled_for,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    payload: row.payload,
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseSyncJobRunRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async listRecentSyncRuns(userId: string, limit: number) {
    const response = await this.client
      .from("sync_job_runs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwOnError(response.error, "List sync job runs");

    return syncJobRunRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapSyncJobRunRow);
  }

  async create(input: {
    userId: string;
    integrationConnectionId: string | null;
    jobType: string;
    triggerType: "scheduled" | "manual" | "retry" | "system" | "webhook";
    dedupeKey: string | null;
    payload: Record<string, unknown>;
  }) {
    const response = await this.client
      .from("sync_job_runs")
      .insert({
        user_id: input.userId,
        integration_connection_id: input.integrationConnectionId,
        job_type: input.jobType,
        status: "queued",
        trigger_type: input.triggerType,
        dedupe_key: input.dedupeKey,
        payload: input.payload,
      })
      .select("*")
      .single();

    return mapSyncJobRunRow(
      syncJobRunRowSchema.parse(
        requireSingleResult(response, "Create sync job run"),
      ),
    );
  }

  async markRunning(id: string) {
    const response = await this.client
      .from("sync_job_runs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", id);

    throwOnError(response.error, "Mark sync job run running");
  }

  async markSucceeded(id: string, result: Record<string, unknown>, attemptCount = 1) {
    const response = await this.client
      .from("sync_job_runs")
      .update({
        status: "succeeded",
        result,
        attempt_count: attemptCount,
        finished_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", id);

    throwOnError(response.error, "Mark sync job run succeeded");
  }

  async markFailed(
    id: string,
    error: { code: string; message: string },
    attemptCount = 1,
  ) {
    const response = await this.client
      .from("sync_job_runs")
      .update({
        status: "failed",
        attempt_count: attemptCount,
        finished_at: new Date().toISOString(),
        error_code: error.code,
        error_message: error.message,
      })
      .eq("id", id);

    throwOnError(response.error, "Mark sync job run failed");
  }
}
