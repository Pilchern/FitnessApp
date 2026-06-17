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
