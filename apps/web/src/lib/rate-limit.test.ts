import { describe, expect, it } from "vitest";
import { evaluateLoginRateLimit, type RateLimitAttempt } from "./rate-limit";

const config = { windowMinutes: 15, maxFailures: 5 };

function attempt(
  minutesAgo: number,
  success: boolean,
  now: Date,
): RateLimitAttempt {
  return {
    success,
    attemptedAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
  };
}

describe("evaluateLoginRateLimit", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");

  it("allows when there are fewer failures than the threshold", () => {
    const attempts = [
      attempt(10, false, now),
      attempt(8, false, now),
      attempt(5, false, now),
    ];
    expect(evaluateLoginRateLimit(attempts, config, now)).toEqual({
      allowed: true,
    });
  });

  it("allows with zero attempts", () => {
    expect(evaluateLoginRateLimit([], config, now)).toEqual({ allowed: true });
  });

  it("blocks once failures reach the threshold within the window", () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      attempt(10 - i, false, now),
    );
    const result = evaluateLoginRateLimit(attempts, config, now);
    expect(result.allowed).toBe(false);
  });

  it("computes retryAfterSeconds relative to the oldest counted failure", () => {
    // Oldest of the 5 counted failures was 10 minutes ago; window is 15 min,
    // so it ages out in 5 minutes (300s) from now.
    const attempts = [
      attempt(10, false, now),
      attempt(8, false, now),
      attempt(6, false, now),
      attempt(4, false, now),
      attempt(2, false, now),
    ];
    const result = evaluateLoginRateLimit(attempts, config, now);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBe(300);
    }
  });

  it("does not count attempts unordered input incorrectly", () => {
    const attempts = [
      attempt(2, false, now),
      attempt(10, false, now),
      attempt(6, false, now),
      attempt(8, false, now),
      attempt(4, false, now),
    ];
    const result = evaluateLoginRateLimit(attempts, config, now);
    expect(result.allowed).toBe(false);
  });

  it("resets the counter after a successful attempt", () => {
    const attempts = [
      attempt(14, false, now),
      attempt(13, false, now),
      attempt(12, false, now),
      attempt(11, false, now),
      attempt(10, false, now),
      attempt(9, true, now),
      attempt(3, false, now),
    ];
    // 5 failures happened before the success at minute 9 — only the single
    // failure after the success should count, well below the threshold.
    expect(evaluateLoginRateLimit(attempts, config, now)).toEqual({
      allowed: true,
    });
  });

  it("locks out again if failures re-accumulate after a success", () => {
    const attempts = [
      attempt(14, true, now),
      attempt(10, false, now),
      attempt(8, false, now),
      attempt(6, false, now),
      attempt(4, false, now),
      attempt(2, false, now),
    ];
    expect(evaluateLoginRateLimit(attempts, config, now).allowed).toBe(false);
  });
});
