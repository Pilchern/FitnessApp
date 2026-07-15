import { describe, expect, it } from "vitest";
import {
  MAX_RETRY_ATTEMPTS,
  computeRetryBackoff,
  isEligibleForDeadLetter,
  isRetryableJobType,
  resolveRetryTarget,
} from "./retry-sweep";

describe("isRetryableJobType", () => {
  it("accepts the two pull-based sync job types", () => {
    expect(isRetryableJobType("cardio_session_sync")).toBe(true);
    expect(isRetryableJobType("body_metric_sync")).toBe(true);
  });

  it("rejects webhook-driven Apple Health job types", () => {
    expect(isRetryableJobType("apple_health_sleep_sync")).toBe(false);
    expect(isRetryableJobType("apple_health_daily_metrics_sync")).toBe(false);
  });

  it("rejects unknown job types", () => {
    expect(isRetryableJobType("something_else")).toBe(false);
  });
});

describe("resolveRetryTarget", () => {
  it("resolves a cardio_session_sync/peloton row", () => {
    expect(resolveRetryTarget("cardio_session_sync", { provider: "peloton" })).toEqual({
      kind: "cardio",
      provider: "peloton",
    });
  });

  it("resolves a cardio_session_sync/strava row", () => {
    expect(resolveRetryTarget("cardio_session_sync", { provider: "strava" })).toEqual({
      kind: "cardio",
      provider: "strava",
    });
  });

  it("resolves a body_metric_sync/withings row", () => {
    expect(resolveRetryTarget("body_metric_sync", { provider: "withings" })).toEqual({
      kind: "body_metric",
      provider: "withings",
    });
  });

  it("returns unsupported for apple_health rows", () => {
    expect(
      resolveRetryTarget("apple_health_sleep_sync", { provider: "apple_health" }),
    ).toEqual({ kind: "unsupported" });
  });

  it("returns unsupported when payload is missing or has no provider", () => {
    expect(resolveRetryTarget("cardio_session_sync", null)).toEqual({ kind: "unsupported" });
    expect(resolveRetryTarget("cardio_session_sync", {})).toEqual({ kind: "unsupported" });
  });

  it("returns unsupported for a mismatched job_type/provider pairing", () => {
    expect(resolveRetryTarget("cardio_session_sync", { provider: "withings" })).toEqual({
      kind: "unsupported",
    });
  });
});

describe("isEligibleForDeadLetter", () => {
  it("is false below MAX_RETRY_ATTEMPTS", () => {
    for (let n = 1; n < MAX_RETRY_ATTEMPTS; n++) {
      expect(isEligibleForDeadLetter(n)).toBe(false);
    }
  });

  it("is true at and beyond MAX_RETRY_ATTEMPTS", () => {
    expect(isEligibleForDeadLetter(MAX_RETRY_ATTEMPTS)).toBe(true);
    expect(isEligibleForDeadLetter(MAX_RETRY_ATTEMPTS + 1)).toBe(true);
  });
});

describe("computeRetryBackoff", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");

  it("attempt 1 -> 5 minutes", () => {
    expect(computeRetryBackoff(1, now).toISOString()).toBe("2026-07-15T12:05:00.000Z");
  });

  it("attempt 2 -> 20 minutes", () => {
    expect(computeRetryBackoff(2, now).toISOString()).toBe("2026-07-15T12:20:00.000Z");
  });

  it("attempt 3 -> 45 minutes", () => {
    expect(computeRetryBackoff(3, now).toISOString()).toBe("2026-07-15T12:45:00.000Z");
  });

  it("attempt 4 -> 80 minutes", () => {
    expect(computeRetryBackoff(4, now).toISOString()).toBe("2026-07-15T13:20:00.000Z");
  });

  it("grows quadratically with the attempt number", () => {
    const first = computeRetryBackoff(1, now).getTime() - now.getTime();
    const second = computeRetryBackoff(2, now).getTime() - now.getTime();
    const third = computeRetryBackoff(3, now).getTime() - now.getTime();
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(second / first).toBeCloseTo(4, 5);
  });
});
