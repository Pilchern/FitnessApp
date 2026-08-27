import { NextRequest, NextResponse } from "next/server";
import { mapWithConcurrency, safeBearerEqual } from "@/lib/server/cron-auth";
import {
  MAX_RETRY_ATTEMPTS,
  computeRetryBackoff,
  isEligibleForDeadLetter,
  resolveRetryTarget,
} from "@fitness-app/jobs";
import {
  createPelotonSyncOrchestrator,
  createStravaSyncOrchestrator,
  createWithingsSyncOrchestrator,
} from "@/lib/server/integrations";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { getServerEnv } from "@/lib/server/env";

const CONCURRENCY = 3;
// Cap how many failed rows a single sweep touches so one bad backlog can't
// turn a 15-minute cron tick into a runaway request.
const SWEEP_BATCH_LIMIT = 100;

type FailedSyncRow = {
  id: string;
  user_id: string | null;
  job_type: string;
  attempt_count: number;
  payload: Record<string, unknown> | null;
};

type SweepOutcome = "retried" | "dead_lettered" | "still_failed";

/**
 * Retry/backoff/dead-letter sweep for TD-014.
 *
 * `sync_job_runs` is the queue: this route does NOT create a new queue
 * table. Every provider sync orchestrator (CardioSyncOrchestrator,
 * BodyMetricSyncOrchestrator) already creates its own fresh `sync_job_runs`
 * row per invocation and marks it succeeded/failed internally — this sweep
 * does not change that. Instead it treats the ORIGINAL failed row as a
 * queue entry: on each sweep tick it re-invokes the appropriate orchestrator
 * for the same user/provider, then updates that original row's
 * status/attempt_count/scheduled_for/error_* to record whether the retry
 * worked, should be retried again later, or has exhausted its attempts.
 *
 * Eligibility: status = 'failed', attempt_count < MAX_RETRY_ATTEMPTS, and
 * scheduled_for is null or in the past (immediately eligible / backoff has
 * elapsed).
 *
 * Backoff: scheduled_for = now + (nextAttemptCount^2) * 5 minutes (see
 * packages/jobs/src/orchestration/retry-sweep.ts for the exact formula and
 * rationale). Once nextAttemptCount >= MAX_RETRY_ATTEMPTS (5), the row is
 * moved to `dead_letter` instead of being rescheduled, and is never picked
 * up again (the `attempt_count < MAX_RETRY_ATTEMPTS` filter excludes it).
 *
 * Only `cardio_session_sync` (Peloton/Strava) and `body_metric_sync`
 * (Withings) rows are retried — these are pull-based syncs that can be
 * safely re-run against the provider's API using the stored connection.
 * Apple Health job types are push/webhook-driven and are intentionally
 * excluded (see retry-sweep.ts).
 *
 * Scheduled every 15 minutes via Supabase pg_cron -> pg_net, see
 * supabase/migrations/20260715160000_add_dead_letter_status_and_retry_sweep.sql.
 *
 * Auth: Bearer token must match CRON_SECRET env var. CRON_SECRET is REQUIRED.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const cronSecret = env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "cron_secret_not_configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!safeBearerEqual(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await client
    .from("sync_job_runs")
    .select("id, user_id, job_type, attempt_count, payload")
    .eq("status", "failed")
    .lt("attempt_count", MAX_RETRY_ATTEMPTS)
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(SWEEP_BATCH_LIMIT);

  if (error) {
    console.error(
      "[cron/retry-failed-syncs] Failed to list failed runs:",
      error,
    );
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const rows = (data ?? []) as FailedSyncRow[];

  const eligible = rows.filter((row) => {
    if (!row.user_id) return false;
    return resolveRetryTarget(row.job_type, row.payload).kind !== "unsupported";
  });

  if (eligible.length === 0) {
    return NextResponse.json({
      swept: 0,
      retried: 0,
      deadLettered: 0,
      stillFailed: 0,
    });
  }

  const settled = await mapWithConcurrency(
    eligible,
    CONCURRENCY,
    async (row): Promise<SweepOutcome> => {
      const target = resolveRetryTarget(row.job_type, row.payload);
      const nextAttemptCount = row.attempt_count + 1;
      const userId = row.user_id as string;

      try {
        if (target.kind === "cardio") {
          const orchestrator =
            target.provider === "peloton"
              ? createPelotonSyncOrchestrator()
              : createStravaSyncOrchestrator();
          await orchestrator.syncRides({
            userId,
            provider: target.provider,
            triggerType: "retry",
          });
        } else if (target.kind === "body_metric") {
          const orchestrator = createWithingsSyncOrchestrator();
          await orchestrator.syncBodyMetrics({
            userId,
            provider: "withings",
            triggerType: "retry",
          });
        }

        // The retry succeeded (the orchestrator's own new sync_job_runs row
        // already records that). Close out the original failed row so the
        // next sweep doesn't pick it up again.
        const { error: updateError } = await client
          .from("sync_job_runs")
          .update({
            status: "succeeded",
            attempt_count: nextAttemptCount,
            finished_at: new Date().toISOString(),
            scheduled_for: null,
            error_code: null,
            error_message: null,
            result: { retriedAt: new Date().toISOString() },
          })
          .eq("id", row.id);

        if (updateError) {
          console.error(
            `[cron/retry-failed-syncs] Retry succeeded but failed to update queue row ${row.id}:`,
            updateError,
          );
        }

        return "retried";
      } catch (retryError) {
        const message =
          retryError instanceof Error
            ? retryError.message
            : "Unknown retry error";

        if (isEligibleForDeadLetter(nextAttemptCount)) {
          const { error: updateError } = await client
            .from("sync_job_runs")
            .update({
              status: "dead_letter",
              attempt_count: nextAttemptCount,
              finished_at: new Date().toISOString(),
              scheduled_for: null,
              error_code: "retry_exhausted",
              error_message: `Retry attempt ${nextAttemptCount}/${MAX_RETRY_ATTEMPTS} failed: ${message}`,
            })
            .eq("id", row.id);

          if (updateError) {
            console.error(
              `[cron/retry-failed-syncs] Failed to dead-letter queue row ${row.id}:`,
              updateError,
            );
          }

          console.error(
            `[cron/retry-failed-syncs] Dead-lettered ${row.job_type} run ${row.id} for user ${userId} after ${nextAttemptCount} attempts:`,
            message,
          );

          return "dead_lettered";
        }

        const scheduledFor = computeRetryBackoff(nextAttemptCount);
        const { error: updateError } = await client
          .from("sync_job_runs")
          .update({
            status: "failed",
            attempt_count: nextAttemptCount,
            scheduled_for: scheduledFor.toISOString(),
            error_code: "retry_failed",
            error_message: message,
          })
          .eq("id", row.id);

        if (updateError) {
          console.error(
            `[cron/retry-failed-syncs] Failed to reschedule queue row ${row.id}:`,
            updateError,
          );
        }

        return "still_failed";
      }
    },
  );

  let retried = 0;
  let deadLettered = 0;
  let stillFailed = 0;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      if (result.value === "retried") retried += 1;
      else if (result.value === "dead_lettered") deadLettered += 1;
      else stillFailed += 1;
    } else {
      // The mapping function itself should not throw (all paths are
      // try/caught), but guard defensively.
      console.error(
        "[cron/retry-failed-syncs] Unexpected sweep error:",
        result.reason,
      );
      stillFailed += 1;
    }
  }

  return NextResponse.json({
    swept: eligible.length,
    retried,
    deadLettered,
    stillFailed,
  });
}
