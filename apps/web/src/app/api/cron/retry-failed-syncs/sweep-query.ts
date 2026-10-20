/**
 * The DB filter for the retry sweep's candidate rows, kept apart from the
 * route so it can be unit-tested (the route itself pulls in path aliases
 * apps/web's vitest run does not resolve).
 *
 * Only rows the sweep could act on reach the 100-row batch: failed, a queue
 * entry rather than a retry record, under the attempt cap, due, tied to a
 * user, and of a job type the sweep knows how to re-run. Without the last
 * two, rows it always skips (cron heartbeats with no user, retired Strava
 * and Peloton syncs) sit at the oldest end of the batch forever and crowd
 * out the rows it can retry.
 */

/** The subset of the Supabase filter builder the sweep uses. */
export interface SweepFilterable {
  eq(column: string, value: string): this;
  neq(column: string, value: string): this;
  not(column: string, operator: string, value: null): this;
  in(column: string, values: string[]): this;
  lt(column: string, value: number): this;
  or(filters: string): this;
  order(column: string, options: { ascending: boolean }): this;
  limit(count: number): this;
}

export type SweepFilterOptions = {
  nowIso: string;
  retrySpawnedTriggerType: string;
  maxAttempts: number;
  retryableJobTypes: readonly string[];
  limit: number;
};

/**
 * `Q` is left unconstrained on purpose: checking Supabase's filter builder
 * against `SweepFilterable` trips TS2589 (type instantiation too deep). Every
 * method used here returns the same builder, so handing `Q` back is sound.
 */
export function applySweepFilters<Q>(query: Q, options: SweepFilterOptions): Q {
  return (query as unknown as SweepFilterable)
    .eq("status", "failed")
    .neq("trigger_type", options.retrySpawnedTriggerType)
    .not("user_id", "is", null)
    .in("job_type", [...options.retryableJobTypes])
    .lt("attempt_count", options.maxAttempts)
    .or(`scheduled_for.is.null,scheduled_for.lte.${options.nowIso}`)
    .order("created_at", { ascending: true })
    .limit(options.limit) as unknown as Q;
}
