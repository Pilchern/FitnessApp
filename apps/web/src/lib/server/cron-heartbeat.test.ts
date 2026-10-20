import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cronHeartbeatJobType,
  cronTriggerType,
  startCronHeartbeat,
} from "./cron-heartbeat";

type Call =
  | { op: "insert"; table: string; row: Record<string, unknown> }
  | {
      op: "update";
      table: string;
      row: Record<string, unknown>;
      id: string;
    };

type FakeOptions = {
  insertError?: { message: string };
  insertThrows?: boolean;
  updateError?: { message: string };
};

function fakeClient(options: FakeOptions = {}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          if (options.insertThrows) throw new Error("network down");
          calls.push({ op: "insert", table, row });
          return {
            select: () => ({
              single: async () =>
                options.insertError
                  ? { data: null, error: options.insertError }
                  : { data: { id: "run-1" }, error: null },
            }),
          };
        },
        update(row: Record<string, unknown>) {
          return {
            eq: async (_col: string, id: string) => {
              calls.push({ op: "update", table, row, id });
              return { error: options.updateError ?? null };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const START = new Date("2026-10-26T08:00:05.000Z");
const END = new Date("2026-10-26T08:00:09.000Z");

function clock() {
  const times = [START, END];
  return () => times.shift() ?? END;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cronHeartbeatJobType", () => {
  it("names each Monday cron's job type", () => {
    expect(cronHeartbeatJobType("weekly-review-auto-finalize")).toBe(
      "cron_weekly_review_auto_finalize",
    );
    expect(cronHeartbeatJobType("insights-generate")).toBe(
      "cron_insights_generate",
    );
  });
});

describe("cronTriggerType", () => {
  it("records Vercel Cron's GET as scheduled and a POST as manual", () => {
    expect(cronTriggerType("GET")).toBe("scheduled");
    expect(cronTriggerType("POST")).toBe("manual");
  });
});

describe("startCronHeartbeat", () => {
  it("writes the trigger type it is given", async () => {
    const { client, calls } = fakeClient();
    await startCronHeartbeat(client, "insights-generate", "manual");

    expect(calls[0].row.trigger_type).toBe("manual");
  });

  it("inserts a running sync_job_runs row with no user, then marks it succeeded", async () => {
    const { client, calls } = fakeClient();

    const heartbeat = await startCronHeartbeat(
      client,
      "weekly-review-auto-finalize",
      "scheduled",
      clock(),
    );
    await heartbeat.finish({ ok: true, summary: { drafted: 1, errors: 0 } });

    expect(calls).toEqual([
      {
        op: "insert",
        table: "sync_job_runs",
        row: {
          user_id: null,
          job_type: "cron_weekly_review_auto_finalize",
          status: "running",
          trigger_type: "scheduled",
          started_at: START.toISOString(),
        },
      },
      {
        op: "update",
        table: "sync_job_runs",
        id: "run-1",
        row: {
          status: "succeeded",
          finished_at: END.toISOString(),
          attempt_count: 1,
          result: { drafted: 1, errors: 0 },
          error_code: null,
          error_message: null,
        },
      },
    ]);
  });

  it("marks the row failed with the error message", async () => {
    const { client, calls } = fakeClient();

    const heartbeat = await startCronHeartbeat(
      client,
      "insights-generate",
      "scheduled",
      clock(),
    );
    await heartbeat.finish({
      ok: false,
      summary: { processed: 1, ok: 0, failed: 1 },
      error: "x".repeat(2000),
    });

    const update = calls[1];
    expect(update.op).toBe("update");
    expect(update.row).toMatchObject({
      status: "failed",
      error_code: "cron_run_failed",
      result: { processed: 1, ok: 0, failed: 1 },
    });
    // Capped so a huge stack or payload echo can't bloat the row.
    expect((update.row.error_message as string).length).toBe(500);
  });

  it("uses only statuses and trigger types the live check constraints allow", async () => {
    const { client, calls } = fakeClient();
    const ok = await startCronHeartbeat(
      client,
      "insights-generate",
      "scheduled",
    );
    await ok.finish({ ok: true });
    const bad = await startCronHeartbeat(client, "insights-generate", "manual");
    await bad.finish({ ok: false });

    const statuses = ["queued", "running", "succeeded", "failed", "cancelled"];
    const triggers = ["scheduled", "manual", "retry", "system", "webhook"];
    for (const call of calls) {
      expect(statuses).toContain(call.row.status);
      if (call.op === "insert") {
        expect(triggers).toContain(call.row.trigger_type);
      }
    }
  });

  it("only finishes once", async () => {
    const { client, calls } = fakeClient();
    const heartbeat = await startCronHeartbeat(
      client,
      "insights-generate",
      "scheduled",
    );
    await heartbeat.finish({ ok: true });
    await heartbeat.finish({ ok: false, error: "late" });

    expect(calls.filter((c) => c.op === "update")).toHaveLength(1);
  });

  it("never throws when the insert fails, and then skips the update", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, calls } = fakeClient({
      insertError: { message: "permission denied" },
    });

    const heartbeat = await startCronHeartbeat(
      client,
      "insights-generate",
      "scheduled",
    );
    await expect(heartbeat.finish({ ok: true })).resolves.toBeUndefined();

    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
    expect(error).toHaveBeenCalled();
  });

  it("never throws when the client itself throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ insertThrows: true });

    const heartbeat = await startCronHeartbeat(
      client,
      "insights-generate",
      "scheduled",
    );
    await expect(heartbeat.finish({ ok: true })).resolves.toBeUndefined();
  });

  it("never throws when the finishing update fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ updateError: { message: "timeout" } });

    const heartbeat = await startCronHeartbeat(
      client,
      "insights-generate",
      "scheduled",
    );
    await expect(heartbeat.finish({ ok: true })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
