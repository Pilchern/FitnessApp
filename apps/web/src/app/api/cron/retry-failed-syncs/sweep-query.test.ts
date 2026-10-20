import { describe, expect, it } from "vitest";
import {
  MAX_RETRY_ATTEMPTS,
  RETRYABLE_JOB_TYPES,
  RETRY_SPAWNED_TRIGGER_TYPE,
} from "../../../../../../../packages/jobs/src/orchestration/retry-sweep";
import { applySweepFilters, type SweepFilterable } from "./sweep-query";

type Row = {
  id: string;
  user_id: string | null;
  job_type: string;
  status: string;
  trigger_type: string;
  attempt_count: number;
  scheduled_for: string | null;
  created_at: string;
};

/**
 * Applies the same filters PostgREST would, over an in-memory table, so the
 * test checks which rows the sweep actually gets back.
 */
class FakeQuery implements SweepFilterable {
  constructor(public rows: Row[]) {}
  private keep(pred: (r: Row) => boolean) {
    this.rows = this.rows.filter(pred);
    return this;
  }
  eq(column: string, value: string) {
    return this.keep((r) => r[column as keyof Row] === value);
  }
  neq(column: string, value: string) {
    return this.keep((r) => r[column as keyof Row] !== value);
  }
  not(column: string, operator: string, value: null) {
    expect(operator).toBe("is");
    return this.keep((r) => r[column as keyof Row] !== value);
  }
  in(column: string, values: string[]) {
    return this.keep((r) => values.includes(r[column as keyof Row] as string));
  }
  lt(column: string, value: number) {
    return this.keep((r) => (r[column as keyof Row] as number) < value);
  }
  or(filters: string) {
    const nowIso = filters.split("scheduled_for.lte.")[1];
    return this.keep(
      (r) => r.scheduled_for === null || r.scheduled_for <= nowIso,
    );
  }
  order(column: string, options: { ascending: boolean }) {
    expect(options.ascending).toBe(true);
    this.rows = [...this.rows].sort((a, b) =>
      String(a[column as keyof Row]).localeCompare(
        String(b[column as keyof Row]),
      ),
    );
    return this;
  }
  limit(count: number) {
    this.rows = this.rows.slice(0, count);
    return this;
  }
}

const NOW = "2026-10-26T10:00:00.000Z";

function row(overrides: Partial<Row>): Row {
  return {
    id: "r",
    user_id: "user-1",
    job_type: "body_metric_sync",
    status: "failed",
    trigger_type: "scheduled",
    attempt_count: 0,
    scheduled_for: null,
    created_at: "2026-10-20T00:00:00.000Z",
    ...overrides,
  };
}

function sweep(rows: Row[], limit = 100) {
  return applySweepFilters(new FakeQuery(rows), {
    nowIso: NOW,
    retrySpawnedTriggerType: RETRY_SPAWNED_TRIGGER_TYPE,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    retryableJobTypes: RETRYABLE_JOB_TYPES,
    limit,
  }).rows.map((r) => r.id);
}

describe("applySweepFilters", () => {
  it("keeps a due, failed Withings run", () => {
    expect(sweep([row({ id: "withings" })])).toEqual(["withings"]);
  });

  it("leaves out failed cron heartbeat rows (no user, cron_ job type)", () => {
    expect(
      sweep([
        row({
          id: "heartbeat",
          user_id: null,
          job_type: "cron_insights_generate",
        }),
      ]),
    ).toEqual([]);
  });

  it("leaves out any row without a user, even of a retryable type", () => {
    expect(sweep([row({ id: "orphan", user_id: null })])).toEqual([]);
  });

  it("leaves out job types the sweep can't re-run", () => {
    expect(
      sweep([
        row({ id: "strava", job_type: "cardio_session_sync" }),
        row({ id: "apple", job_type: "apple_health_sleep_sync" }),
      ]),
    ).toEqual([]);
  });

  it("does not let old skipped rows crowd retryable ones out of the batch", () => {
    const oldHeartbeats = Array.from({ length: 5 }, (_, i) =>
      row({
        id: `hb-${i}`,
        user_id: null,
        job_type: "cron_weekly_review_auto_finalize",
        created_at: `2026-10-0${i + 1}T08:00:00.000Z`,
      }),
    );
    const withings = row({
      id: "withings",
      created_at: "2026-10-25T13:30:00.000Z",
    });

    expect(sweep([...oldHeartbeats, withings], 2)).toEqual(["withings"]);
  });

  it("still applies the existing status, trigger, attempt and backoff filters", () => {
    expect(
      sweep([
        row({ id: "ok-status", status: "succeeded" }),
        row({ id: "retry-record", trigger_type: RETRY_SPAWNED_TRIGGER_TYPE }),
        row({ id: "exhausted", attempt_count: MAX_RETRY_ATTEMPTS }),
        row({ id: "not-due", scheduled_for: "2026-10-26T11:00:00.000Z" }),
        row({ id: "due", scheduled_for: "2026-10-26T09:00:00.000Z" }),
      ]),
    ).toEqual(["due"]);
  });
});
