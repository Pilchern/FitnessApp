// No `import "server-only"` for the same reason as cron-auth.ts: this is a
// tested helper and that guard does not resolve under vitest. It holds no
// secret; the caller passes in the already-built admin client.
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Records each scheduled cron run in `sync_job_runs` so a run (or its
 * absence) can be checked in SQL afterwards. Vercel Hobby keeps runtime logs
 * for one hour, so without this a Monday cron that never fired looks the same
 * as one that ran and found nothing to do.
 *
 * One row per run: inserted as `running` when the route starts, updated to
 * `succeeded` or `failed` when it finishes. `user_id` is null (the run covers
 * every profile). The retry-failed-syncs sweep's query only selects rows with
 * a user and a retryable job type (see that route's sweep-query.ts), so a
 * failed heartbeat is never retried and never takes a slot in its batch.
 *
 * `trigger_type` is `scheduled` for Vercel Cron's GET and `manual` for a POST
 * (pg_cron or a hand-run curl); see cronTriggerType.
 *
 *   select job_type, status, started_at, finished_at, result, error_message
 *   from sync_job_runs where job_type like 'cron_%' order by created_at desc;
 *
 * Heartbeat writes never throw: a failed insert or update is logged and the
 * cron's own work carries on.
 */

export type CronHeartbeatJob =
  | "weekly-review-auto-finalize"
  | "insights-generate";

export function cronHeartbeatJobType(job: CronHeartbeatJob): string {
  return `cron_${job.replace(/-/g, "_")}`;
}

export type CronTriggerType = "scheduled" | "manual";

/** Vercel Cron always sends GET; anything else was started by hand. */
export function cronTriggerType(method: string): CronTriggerType {
  return method === "GET" ? "scheduled" : "manual";
}

export type CronHeartbeatOutcome = {
  ok: boolean;
  /** Counts only. Never rows, user data or health values. */
  summary?: Record<string, number>;
  error?: string;
};

export type CronHeartbeat = {
  finish(outcome: CronHeartbeatOutcome): Promise<void>;
};

const MAX_ERROR_LENGTH = 500;

function logPrefix(job: CronHeartbeatJob) {
  return `[cron/${job}] heartbeat`;
}

export async function startCronHeartbeat(
  client: SupabaseClient,
  job: CronHeartbeatJob,
  triggerType: CronTriggerType,
  now: () => Date = () => new Date(),
): Promise<CronHeartbeat> {
  let runId: string | null = null;

  try {
    const { data, error } = await client
      .from("sync_job_runs")
      .insert({
        user_id: null,
        job_type: cronHeartbeatJobType(job),
        status: "running",
        trigger_type: triggerType,
        started_at: now().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error(`${logPrefix(job)} start failed:`, error.message);
    } else {
      runId = (data as { id: string } | null)?.id ?? null;
    }
  } catch (err) {
    console.error(
      `${logPrefix(job)} start failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  let finished = false;

  return {
    async finish(outcome) {
      if (finished || !runId) return;
      finished = true;

      try {
        const { error } = await client
          .from("sync_job_runs")
          .update({
            status: outcome.ok ? "succeeded" : "failed",
            finished_at: now().toISOString(),
            attempt_count: 1,
            result: outcome.summary ?? {},
            error_code: outcome.ok ? null : "cron_run_failed",
            error_message: outcome.ok
              ? null
              : (outcome.error ?? "Unknown error").slice(0, MAX_ERROR_LENGTH),
          })
          .eq("id", runId);

        if (error) {
          console.error(`${logPrefix(job)} finish failed:`, error.message);
        }
      } catch (err) {
        console.error(
          `${logPrefix(job)} finish failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    },
  };
}
