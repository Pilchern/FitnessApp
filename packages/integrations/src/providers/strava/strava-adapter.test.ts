import { afterEach, describe, expect, it, vi } from "vitest";
import { StravaCardioAdapter } from "./strava-adapter";

const adapter = new StravaCardioAdapter({
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:3000/api/integrations/strava/callback",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StravaCardioAdapter.fetchCardioSessions", () => {
  it("advances the cursor to the MAX occurredAt across fetched activities (Strava returns oldest-first)", async () => {
    const oldest = "2026-01-01T00:00:00Z";
    const middle = "2026-02-15T00:00:00Z";
    const newest = "2026-03-30T00:00:00Z";

    const stravaResponse = [
      { id: 1, name: "Old", sport_type: "Run", start_date: oldest, elapsed_time: 3600, distance: 1000 },
      { id: 2, name: "Mid", sport_type: "Run", start_date: middle, elapsed_time: 3600, distance: 1000 },
      { id: 3, name: "New", sport_type: "Run", start_date: newest, elapsed_time: 3600, distance: 1000 },
    ];

    const fetchSpy = vi
      .spyOn(globalThis, "fetch" as never)
      // first page returns 3 items, second page returns 0 to terminate the loop
      .mockResolvedValueOnce(
        new Response(JSON.stringify(stravaResponse), { status: 200 }) as never,
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }) as never,
      );

    const page = await adapter.fetchCardioSessions({
      accessToken: "token",
      providerUserId: "1",
      lastCursor: "100",
    });

    const expected = String(Math.floor(new Date(newest).getTime() / 1000));
    expect(page.nextCursor).toBe(expected);
    expect(Number(page.nextCursor)).toBeGreaterThan(100);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("does not regress the cursor when zero activities are returned", async () => {
    vi.spyOn(globalThis, "fetch" as never).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }) as never,
    );

    const page = await adapter.fetchCardioSessions({
      accessToken: "token",
      providerUserId: "1",
      lastCursor: "999",
    });

    expect(page.nextCursor).toBe("999");
  });
});

describe("StravaCardioAdapter.mapRawCardioItem", () => {
  it("never populates cadenceMax, resistanceMin, or resistanceMax — Strava has no equivalent fields (Peloton fidelity gap)", () => {
    const mapped = adapter.mapRawCardioItem(
      {
        providerEventType: "strava_activity",
        providerExternalId: "1",
        occurredAt: "2026-03-01T12:00:00Z",
        payload: {
          id: 1,
          name: "Morning Ride",
          sport_type: "Ride",
          start_date: "2026-03-01T12:00:00Z",
          elapsed_time: 1800,
          distance: 16093,
          average_cadence: 82,
          average_watts: 166.7,
        },
      },
      { importBatchId: "batch-1" as never, rawImportEventId: "raw-1" as never },
    );

    expect(mapped).not.toBeNull();
    // Strava only reports a single average cadence value and no resistance
    // metric at all, unlike Peloton (which provides cadenceMin/cadenceMax
    // from avg/max_cadence and resistanceMin/resistanceMax from
    // avg/max_resistance). This is the exact fidelity gap the
    // Peloton-vs-Strava decision hinged on — pin it down explicitly.
    expect(mapped?.cadenceMax).toBeNull();
    expect(mapped?.resistanceMin).toBeNull();
    expect(mapped?.resistanceMax).toBeNull();
    // cadenceMin and avgOutput ARE available from Strava, for contrast.
    expect(mapped?.cadenceMin).toBe(82);
    expect(mapped?.avgOutput).toBe(166.7);
  });
});
