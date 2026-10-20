import { describe, expect, it } from "vitest";
import { restEndDue, restRunning, restSecondsLeft } from "./rest-timer";

const START = 1_700_000_000_000;

describe("restSecondsLeft", () => {
  it("is 0 with no rest", () => {
    expect(restSecondsLeft(null, START)).toBe(0);
  });

  it("rounds up partial seconds", () => {
    expect(restSecondsLeft(START + 90_000, START)).toBe(90);
    expect(restSecondsLeft(START + 90_000, START + 500)).toBe(90);
    expect(restSecondsLeft(START + 90_000, START + 89_001)).toBe(1);
  });

  it("never goes below 0", () => {
    expect(restSecondsLeft(START, START)).toBe(0);
    expect(restSecondsLeft(START, START + 60_000)).toBe(0);
  });
});

describe("restRunning", () => {
  it("is true until the end time, then false", () => {
    expect(restRunning(null, START)).toBe(false);
    expect(restRunning(START + 1_000, START)).toBe(true);
    expect(restRunning(START + 1_000, START + 999)).toBe(true);
    expect(restRunning(START + 1_000, START + 1_000)).toBe(false);
  });
});

describe("restEndDue", () => {
  it("fires once when the rest runs out", () => {
    const endsAt = START + 60_000;
    expect(restEndDue(endsAt, START + 59_500, false)).toBe(false);
    expect(restEndDue(endsAt, START + 60_000, false)).toBe(true);
    expect(restEndDue(endsAt, START + 60_000, true)).toBe(false);
  });

  it("still fires when the tick lands late (throttled timer)", () => {
    expect(restEndDue(START + 60_000, START + 75_000, false)).toBe(true);
  });

  it("does not fire with no rest", () => {
    expect(restEndDue(null, START, false)).toBe(false);
  });
});
