import { afterEach, describe, expect, it, vi } from "vitest";
import { PelotonCardioAdapter } from "./peloton-adapter";

const adapter = new PelotonCardioAdapter();

afterEach(() => {
  vi.restoreAllMocks();
});

function isoSecondsUtc(y: number, m: number, d: number, h: number, min: number, s = 0): number {
  return Math.floor(Date.UTC(y, m, d, h, min, s) / 1000);
}

describe("PelotonCardioAdapter.mapRawCardioItem", () => {
  it("maps every field and unit conversion correctly for a complete workout with all optional fields present", () => {
    const startTime = isoSecondsUtc(2026, 2, 1, 12, 0, 0); // 2026-03-01T12:00:00Z
    const endTime = startTime + 1800;

    const workout = {
      id: "workout-1",
      user_id: "user-1",
      created_at: startTime - 60,
      start_time: startTime,
      end_time: endTime,
      status: "COMPLETE",
      fitness_discipline: "cycling",
      name: "30 min Power Zone Endurance Ride",
      duration: 1800, // 30 minutes
      avg_heart_rate: 140,
      max_heart_rate: 165,
      total_output: 300, // kJ
      avg_cadence: 82,
      max_cadence: 95,
      avg_resistance: 45.5,
      max_resistance: 60.2,
      avg_speed: 20,
      distance: 10, // miles
      ride: {
        id: "ride-1",
        title: "30 min Power Zone Endurance Ride",
        duration: 1800,
        difficulty_estimate: 6.5,
        fitness_discipline: "cycling",
      },
    };

    const mapped = adapter.mapRawCardioItem(
      {
        providerEventType: "peloton_workout",
        providerExternalId: "workout-1",
        occurredAt: new Date(startTime * 1000).toISOString(),
        payload: workout,
      },
      { importBatchId: "batch-1" as never, rawImportEventId: "raw-1" as never },
    );

    expect(mapped).not.toBeNull();
    expect(mapped).toMatchObject({
      sessionDate: "2026-03-01",
      startedAt: "2026-03-01T12:00:00.000Z",
      endedAt: "2026-03-01T12:30:00.000Z",
      sessionKind: "zone2",
      plannedVsCompleted: "completed",
      durationMinutes: 30,
      zone2Minutes: 30,
      avgHeartRate: 140,
      maxHeartRate: 165,
      // (300 kJ * 1000) / 1800s = 166.666.. -> toFixed(1)
      avgOutput: 166.7,
      cadenceMin: 82,
      cadenceMax: 95,
      resistanceMin: 45.5,
      resistanceMax: 60.2,
      // 10 miles * 1609.344 = 16093.44 -> rounded
      distanceMeters: 16093,
      notes: "Peloton: 30 min Power Zone Endurance Ride",
      providerExternalId: "workout-1",
    });
  });

  it("maps optional numeric fields to null (not 0 or NaN) when they are missing", () => {
    const createdAt = isoSecondsUtc(2026, 2, 1, 9, 0, 0);

    const workout = {
      id: "workout-2",
      user_id: "user-1",
      created_at: createdAt,
      status: "COMPLETE",
      duration: 1200,
      // total_output, avg_cadence, max_cadence, avg_resistance, max_resistance,
      // avg_heart_rate, max_heart_rate, distance are all omitted/undefined.
    };

    const mapped = adapter.mapRawCardioItem(
      {
        providerEventType: "peloton_workout",
        providerExternalId: "workout-2",
        occurredAt: new Date(createdAt * 1000).toISOString(),
        payload: workout,
      },
      { importBatchId: "batch-1" as never, rawImportEventId: "raw-2" as never },
    );

    expect(mapped).not.toBeNull();
    expect(mapped?.avgOutput).toBeNull();
    expect(mapped?.cadenceMin).toBeNull();
    expect(mapped?.cadenceMax).toBeNull();
    expect(mapped?.resistanceMin).toBeNull();
    expect(mapped?.resistanceMax).toBeNull();
    expect(mapped?.avgHeartRate).toBeNull();
    expect(mapped?.maxHeartRate).toBeNull();
    expect(mapped?.distanceMeters).toBeNull();
    // None of the "missing" fields should ever come out as 0 or NaN.
    for (const value of [
      mapped?.avgOutput,
      mapped?.cadenceMin,
      mapped?.cadenceMax,
      mapped?.resistanceMin,
      mapped?.resistanceMax,
      mapped?.distanceMeters,
    ]) {
      expect(value).not.toBe(0);
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("returns null (skips) a workout whose status is not COMPLETE", () => {
    const createdAt = isoSecondsUtc(2026, 2, 1, 9, 0, 0);

    const workout = {
      id: "workout-3",
      user_id: "user-1",
      created_at: createdAt,
      status: "IN_PROGRESS",
      duration: 900,
    };

    const mapped = adapter.mapRawCardioItem(
      {
        providerEventType: "peloton_workout",
        providerExternalId: "workout-3",
        occurredAt: new Date(createdAt * 1000).toISOString(),
        payload: workout,
      },
      { importBatchId: "batch-1" as never, rawImportEventId: "raw-3" as never },
    );

    expect(mapped).toBeNull();
  });
});

describe("PelotonCardioAdapter.fetchCardioSessions", () => {
  it("filters out non-COMPLETE and non-cycling workouts at the page-fetch layer", async () => {
    const completeTime = isoSecondsUtc(2026, 2, 1, 12, 0, 0);
    const incompleteTime = isoSecondsUtc(2026, 1, 28, 12, 0, 0);
    const nonCyclingTime = isoSecondsUtc(2026, 1, 20, 12, 0, 0);

    const responseBody = {
      data: [
        {
          id: "w-complete",
          user_id: "user-1",
          created_at: completeTime,
          start_time: completeTime,
          status: "COMPLETE",
          fitness_discipline: "cycling",
        },
        {
          id: "w-incomplete",
          user_id: "user-1",
          created_at: incompleteTime,
          start_time: incompleteTime,
          status: "IN_PROGRESS",
          fitness_discipline: "cycling",
        },
        {
          id: "w-noncycling",
          user_id: "user-1",
          created_at: nonCyclingTime,
          start_time: nonCyclingTime,
          status: "COMPLETE",
          fitness_discipline: "running",
        },
      ],
      total: 3,
      count: 3,
      page: 0,
      page_count: 1,
    };

    vi.spyOn(globalThis, "fetch" as never).mockResolvedValueOnce(
      new Response(JSON.stringify(responseBody), { status: 200 }) as never,
    );

    const page = await adapter.fetchCardioSessions({
      sessionToken: "session-token",
      providerUserId: "user-1",
      lastCursor: null,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].providerExternalId).toBe("w-complete");
    expect(page.nextCursor).toBe(new Date(completeTime * 1000).toISOString());
  });
});

describe("PelotonCardioAdapter.authenticate", () => {
  it("returns the session token and provider user id on a successful login", async () => {
    vi.spyOn(globalThis, "fetch" as never).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ user_id: "user-1", session_id: "session-abc" }),
        { status: 200 },
      ) as never,
    );

    const result = await adapter.authenticate({
      username: "rider@example.com",
      password: "hunter2",
    });

    expect(result).toEqual({
      sessionToken: "session-abc",
      providerUserId: "user-1",
    });
  });

  it("throws with the status code and body when login fails", async () => {
    vi.spyOn(globalThis, "fetch" as never).mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }) as never,
    );

    await expect(
      adapter.authenticate({ username: "rider@example.com", password: "wrong" }),
    ).rejects.toThrow("Peloton API error 401");
  });
});
