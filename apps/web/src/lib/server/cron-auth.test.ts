import { describe, expect, it } from "vitest";
import { mapWithConcurrency, safeBearerEqual } from "./cron-auth";

const SECRET = "s3cr3t-cron-token";

describe("safeBearerEqual", () => {
  it("accepts the correct bearer header", () => {
    expect(safeBearerEqual(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects a wrong token of the same length", () => {
    const wrong = "x".repeat(SECRET.length);
    expect(wrong).toHaveLength(SECRET.length);
    expect(safeBearerEqual(`Bearer ${wrong}`, SECRET)).toBe(false);
  });

  it("rejects a wrong token of a different length without throwing", () => {
    // The length guard is load-bearing: timingSafeEqual throws on mismatched
    // buffer lengths, so removing it turns a 401 into an unhandled 500.
    expect(() => safeBearerEqual("Bearer short", SECRET)).not.toThrow();
    expect(safeBearerEqual("Bearer short", SECRET)).toBe(false);
    expect(safeBearerEqual(`Bearer ${SECRET}extra`, SECRET)).toBe(false);
  });

  it("rejects the raw secret without the Bearer prefix", () => {
    expect(safeBearerEqual(SECRET, SECRET)).toBe(false);
  });

  it("rejects an empty or absent header", () => {
    expect(safeBearerEqual("", SECRET)).toBe(false);
  });

  it("rejects a lowercase scheme", () => {
    expect(safeBearerEqual(`bearer ${SECRET}`, SECRET)).toBe(false);
  });

  it("is not fooled by a prefix of the correct header", () => {
    expect(safeBearerEqual(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe(
      false,
    );
  });

  it("compares against multi-byte secrets by byte length", () => {
    const unicode = "sécret-🔐";
    expect(safeBearerEqual(`Bearer ${unicode}`, unicode)).toBe(true);
    expect(safeBearerEqual(`Bearer ${unicode}x`, unicode)).toBe(false);
  });
});

describe("mapWithConcurrency", () => {
  it("keeps results index-aligned with the input", async () => {
    // The routes index rows[i] against results[i]; misalignment would attach
    // one user's outcome to another user's row.
    const items = [10, 20, 30, 40, 50];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      // Finish in reverse order so completion order can't be what aligns them.
      await new Promise((r) => setTimeout(r, (60 - n) / 10));
      return n * 2;
    });

    expect(
      results.map((r) => (r.status === "fulfilled" ? r.value : null)),
    ).toEqual([20, 40, 60, 80, 100]);
  });

  it("captures a rejection as a rejected result instead of throwing", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });

    expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(results[1].status).toBe("rejected");
    expect(
      results[1].status === "rejected"
        ? (results[1].reason as Error).message
        : null,
    ).toBe("boom");
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 });
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
        return null;
      },
    );

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("does not spawn idle workers when the limit exceeds the item count", async () => {
    let started = 0;
    await mapWithConcurrency([1, 2], 100, async (n) => {
      started += 1;
      return n;
    });

    expect(started).toBe(2);
  });

  it("returns an empty array for no items", async () => {
    let called = false;
    const results = await mapWithConcurrency([], 3, async () => {
      called = true;
      return 1;
    });

    expect(results).toEqual([]);
    expect(called).toBe(false);
  });

  it("processes every item exactly once", async () => {
    const seen: number[] = [];
    await mapWithConcurrency(
      Array.from({ length: 50 }, (_, i) => i),
      5,
      async (n) => {
        seen.push(n);
        return n;
      },
    );

    expect(seen).toHaveLength(50);
    expect(new Set(seen).size).toBe(50);
  });
});
