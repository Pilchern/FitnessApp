import { describe, expect, it } from "vitest";
import { SupabaseStrengthSessionRepository } from "./strength-session-repository";

const userId = "22222222-2222-4222-8222-222222222222";

function uuid(prefix: number, n: number) {
  return `${String(prefix).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function sessionRow(n: number) {
  return {
    id: uuid(1, n),
    user_id: userId,
    training_template_id: null,
    session_date: "2026-10-13",
    session_name: null,
    notes: null,
    duration_minutes: null,
    readiness_pre: null,
    energy_post: null,
    completed_as_planned: true,
    source_type: "manual",
    source_provider: null,
    source_external_id: null,
    import_batch_id: null,
    raw_import_event_id: null,
    created_at: `2026-10-13T12:00:${String(n % 60).padStart(2, "0")}.000Z`,
    updated_at: "2026-10-13T12:00:00.000Z",
    deleted_at: null,
  };
}

function setRow(sessionId: string, n: number) {
  return {
    id: uuid(2, n),
    user_id: userId,
    strength_session_id: sessionId,
    exercise_name: "Bench Press",
    exercise_order: 0,
    set_order: n,
    reps: 5,
    weight: 100,
    rir: null,
    is_warmup: false,
    duration_seconds: null,
    distance_meters: null,
    notes: null,
    created_at: "2026-10-13T12:00:00.000Z",
    updated_at: "2026-10-13T12:00:00.000Z",
    deleted_at: null,
  };
}

type Row = Record<string, unknown>;

/** Minimal PostgREST stand-in: honours `in`, `order` and `range` like the server. */
function fakeClient(tables: Record<string, Row[]>, maxRows = 1000) {
  const calls: { table: string; inSize?: number; range?: [number, number] }[] =
    [];

  function builder(table: string) {
    const call: (typeof calls)[number] = { table };
    calls.push(call);
    let rows = [...(tables[table] ?? [])];
    const orders: { column: string; ascending: boolean }[] = [];
    let range: [number, number] | null = null;

    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        rows = rows.filter((row) => row[column] === value);
        return query;
      },
      is: () => query,
      gte: () => query,
      lte: () => query,
      limit: () => query,
      in: (column: string, values: unknown[]) => {
        call.inSize = values.length;
        rows = rows.filter((row) => values.includes(row[column]));
        return query;
      },
      order: (column: string, options: { ascending: boolean }) => {
        orders.push({ column, ascending: options.ascending });
        return query;
      },
      range: (from: number, to: number) => {
        range = [from, to];
        call.range = range;
        return query;
      },
      then: (resolve: (value: { data: Row[]; error: null }) => void) => {
        const sorted = [...rows].sort((a, b) => {
          for (const { column, ascending } of orders) {
            const left = String(a[column]).padStart(20, "0");
            const right = String(b[column]).padStart(20, "0");
            if (left !== right) {
              return (left < right ? -1 : 1) * (ascending ? 1 : -1);
            }
          }
          return 0;
        });
        const [from, to] = range ?? [0, maxRows - 1];
        resolve({
          data: sorted.slice(from, Math.min(to + 1, from + maxRows)),
          error: null,
        });
      },
    };
    return query;
  }

  return { client: { from: builder } as never, calls };
}

describe("SupabaseStrengthSessionRepository.listByDateRange", () => {
  it("loads every set past the 1000-row page cap, in set order", async () => {
    const session = sessionRow(1);
    const sets = Array.from({ length: 2500 }, (_, i) =>
      setRow(session.id, i + 1),
    ).reverse();
    const { client } = fakeClient({
      strength_sessions: [session],
      strength_exercise_sets: sets,
    });

    const [result] = await new SupabaseStrengthSessionRepository(
      client,
    ).listByDateRange({ userId });

    expect(result.sets).toHaveLength(2500);
    expect(result.sets.map((set) => set.setNumber)).toEqual(
      Array.from({ length: 2500 }, (_, i) => i + 1),
    );
  });

  it("queries sets for at most 100 session ids at a time", async () => {
    const sessions = Array.from({ length: 250 }, (_, i) => sessionRow(i + 1));
    const sets = sessions.map((session, i) => setRow(session.id, i + 1));
    const { client, calls } = fakeClient({
      strength_sessions: sessions,
      strength_exercise_sets: sets,
    });

    const result = await new SupabaseStrengthSessionRepository(
      client,
    ).listByDateRange({ userId });

    const setCalls = calls.filter(
      (call) => call.table === "strength_exercise_sets",
    );
    expect(setCalls.map((call) => call.inSize)).toEqual([100, 100, 50]);
    expect(result.every((session) => session.sets.length === 1)).toBe(true);
  });
});

describe("SupabaseStrengthSessionRepository program session link", () => {
  const programSessionId = "33333333-3333-4333-8333-333333333333";

  /** Records insert and update payloads; returns `stored` as the session row. */
  function writeClient(stored: Row) {
    const writes: { table: string; payload: Row }[] = [];
    const from = (table: string) => {
      const result = () =>
        table === "strength_sessions"
          ? { data: stored, error: null }
          : { data: [], error: null };
      const query = {
        insert: (payload: Row) => {
          writes.push({ table, payload });
          return query;
        },
        update: (payload: Row) => {
          writes.push({ table, payload });
          return query;
        },
        select: () => query,
        eq: () => query,
        is: () => query,
        single: () => Promise.resolve(result()),
        then: (resolve: (value: unknown) => void) => resolve(result()),
      };
      return query;
    };
    const sessionWrite = () =>
      writes.find((w) => w.table === "strength_sessions")?.payload;
    return { client: { from } as never, sessionWrite };
  }

  const input = {
    userId,
    sessionDate: "2026-10-19",
    sessionName: null,
    notes: null,
    completedAsPlanned: true,
    source: {
      sourceType: "manual" as const,
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    },
    sets: [
      {
        exerciseName: "Leg Press",
        exerciseOrder: 0,
        setNumber: 1,
        reps: 10,
        weight: 100,
        isWarmup: false,
        notes: null,
      },
    ],
  };

  it("saves the link from a program start and reads it back", async () => {
    const { client, sessionWrite } = writeClient({
      ...sessionRow(1),
      program_session_id: programSessionId,
    });
    const saved = await new SupabaseStrengthSessionRepository(client).create({
      ...input,
      programSessionId,
    });
    expect(sessionWrite()?.program_session_id).toBe(programSessionId);
    expect(saved.programSessionId).toBe(programSessionId);
  });

  it("leaves the column out for manual logging and reads old rows as unlinked", async () => {
    const { client, sessionWrite } = writeClient(sessionRow(1));
    const saved = await new SupabaseStrengthSessionRepository(client).create(
      input,
    );
    expect(sessionWrite()).not.toHaveProperty("program_session_id");
    expect(saved.programSessionId).toBeNull();
  });

  it("keeps an existing link when an edit does not send one", async () => {
    const { client, sessionWrite } = writeClient({
      ...sessionRow(1),
      program_session_id: programSessionId,
    });
    const saved = await new SupabaseStrengthSessionRepository(client).update({
      ...input,
      id: sessionRow(1).id,
    });
    expect(sessionWrite()).not.toHaveProperty("program_session_id");
    expect(saved.programSessionId).toBe(programSessionId);
  });

  it("clears the link when an update sends null", async () => {
    const { client, sessionWrite } = writeClient(sessionRow(1));
    const saved = await new SupabaseStrengthSessionRepository(client).update({
      ...input,
      id: sessionRow(1).id,
      programSessionId: null,
    });
    expect(sessionWrite()).toHaveProperty("program_session_id", null);
    expect(saved.programSessionId).toBeNull();
  });
});
