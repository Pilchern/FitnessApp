/**
 * Pure logic for the `/api/cron/retry-failed-syncs` sweep (TD-014).
 *
 * `sync_job_runs` IS the retry queue — no new queue table. Each provider
 * sync (`CardioSyncOrchestrator.syncRides`, `BodyMetricSyncOrchestrator.syncBodyMetrics`)
 * already creates a fresh `sync_job_runs` row per invocation and marks it
 * succeeded/failed itself (see cardio-sync.ts / body-metric-sync.ts). This
 * module does NOT change that behavior — it only computes, from a row that
 * is currently `failed`, whether/when to retry it and when to give up.
 *
 * Kept framework-free (no Supabase/Next imports) so it is unit-testable
 * without a live database, per packages/jobs conventions.
 */

/**
 * Maximum number of retry attempts before a failed sync is permanently
 * dead-lettered. Chosen to bound retry duration to roughly a day at the
 * backoff formula below (5 attempts -> ~4h15m of cumulative backoff) while
 * still giving transient provider outages (OAuth hiccups, rate limits)
 * several chances to clear on their own.
 */
export const MAX_RETRY_ATTEMPTS = 5;

/** Base unit for the backoff formula, in minutes. */
export const RETRY_BACKOFF_UNIT_MINUTES = 5;

/**
 * Job types that the retry sweep knows how to re-invoke. Apple Health syncs
 * (`apple_health_sleep_sync`, `apple_health_daily_metrics_sync`) are
 * webhook/push-driven — the raw payload arrives with the webhook request and
 * isn't independently re-fetchable from Apple, so there is nothing for a
 * scheduled sweep to safely re-run. Those are intentionally excluded; a
 * failed webhook delivery is retried by the sender (Apple Health Auto
 * Export), not by us.
 */
export const RETRYABLE_JOB_TYPES = ["cardio_session_sync", "body_metric_sync"] as const;

export type RetryableJobType = (typeof RETRYABLE_JOB_TYPES)[number];

export function isRetryableJobType(jobType: string): jobType is RetryableJobType {
  return (RETRYABLE_JOB_TYPES as readonly string[]).includes(jobType);
}

export type RetryTarget =
  | { kind: "cardio"; provider: "peloton" | "strava" }
  | { kind: "body_metric"; provider: "withings" }
  | { kind: "unsupported" };

/**
 * Resolve which orchestrator/provider a failed `sync_job_runs` row belongs
 * to. Both `CardioSyncOrchestrator.syncRides` and
 * `BodyMetricSyncOrchestrator.syncBodyMetrics` stamp `payload.provider` on
 * every run they create (see `dedupeKey`/payload construction in
 * cardio-sync.ts and body-metric-sync.ts), so we read it back from there
 * rather than joining to `integration_connections`.
 */
export function resolveRetryTarget(
  jobType: string,
  payload: Record<string, unknown> | null | undefined,
): RetryTarget {
  const provider = typeof payload?.provider === "string" ? payload.provider : null;

  if (jobType === "cardio_session_sync" && (provider === "peloton" || provider === "strava")) {
    return { kind: "cardio", provider };
  }

  if (jobType === "body_metric_sync" && provider === "withings") {
    return { kind: "body_metric", provider: "withings" };
  }

  return { kind: "unsupported" };
}

/**
 * A row is eligible for dead-lettering once its *next* attempt count would
 * reach MAX_RETRY_ATTEMPTS. Callers pass the attempt count the row will have
 * AFTER the current retry (i.e. `attemptCount + 1`).
 */
export function isEligibleForDeadLetter(nextAttemptCount: number): boolean {
  return nextAttemptCount >= MAX_RETRY_ATTEMPTS;
}

/**
 * Exponential backoff: `scheduled_for = now + (nextAttemptCount^2) * 5 minutes`.
 *
 * Attempt 1 -> 5m, attempt 2 -> 20m, attempt 3 -> 45m, attempt 4 -> 80m,
 * attempt 5 -> would be 125m but attempt 5 is dead-lettered instead (see
 * `isEligibleForDeadLetter`) so it never actually gets scheduled.
 */
export function computeRetryBackoff(nextAttemptCount: number, now: Date = new Date()): Date {
  const minutes = nextAttemptCount * nextAttemptCount * RETRY_BACKOFF_UNIT_MINUTES;
  return new Date(now.getTime() + minutes * 60_000);
}
