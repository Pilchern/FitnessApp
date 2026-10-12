import { describe, expect, it } from "vitest";
import {
  buildAppleHealthStreamStatus,
  buildFlashMessage,
  getIntegrationStatusGuidance,
  isFailureUnresolved,
} from "./helpers";

describe("buildFlashMessage", () => {
  it("prioritizes explicit errors", () => {
    expect(buildFlashMessage("connected", "Something broke")).toEqual({
      tone: "error",
      text: "Something broke",
    });
  });

  it("maps known integration success states", () => {
    expect(buildFlashMessage("connected")).toEqual({
      tone: "success",
      text: "Withings connected. Your measurements are syncing now.",
    });
  });
});

describe("getIntegrationStatusGuidance", () => {
  it("returns guidance for missing connections", () => {
    expect(getIntegrationStatusGuidance(null)).toMatchObject({
      tone: "default",
    });
  });

  it("returns alert guidance for error states", () => {
    expect(
      getIntegrationStatusGuidance({
        status: "error",
      } as never),
    ).toMatchObject({
      tone: "alert",
    });
  });
});

describe("buildAppleHealthStreamStatus", () => {
  const now = new Date("2026-10-12T18:00:00Z");

  it("marks metrics stale after 6 hours and sleep after 36", () => {
    const status = buildAppleHealthStreamStatus(
      {
        daily: "2026-10-12T11:00:00Z",
        sleep: "2026-10-11T12:00:00Z",
        workouts: null,
      },
      now,
      "America/Chicago",
    );
    expect(status.daily.stale).toBe(true);
    expect(status.sleep.stale).toBe(false);
    expect(status.workouts).toEqual({
      lastReceivedLabel: "—",
      received: false,
      stale: false,
    });
  });

  it("formats in the given timezone", () => {
    const status = buildAppleHealthStreamStatus(
      { daily: "2026-10-12T17:30:00Z", sleep: null, workouts: null },
      now,
      "America/Chicago",
    );
    expect(status.daily.lastReceivedLabel).toBe("Oct 12, 12:30 PM");
  });
});

describe("isFailureUnresolved", () => {
  it("is true only when the failure is newer than the last success", () => {
    expect(isFailureUnresolved(null, "2026-10-12T00:00:00Z")).toBe(false);
    expect(isFailureUnresolved("2026-10-12T00:00:00Z", null)).toBe(true);
    expect(
      isFailureUnresolved("2026-10-11T00:00:00Z", "2026-10-12T00:00:00Z"),
    ).toBe(false);
    expect(
      isFailureUnresolved("2026-10-12T01:00:00Z", "2026-10-12T00:00:00Z"),
    ).toBe(true);
  });
});
