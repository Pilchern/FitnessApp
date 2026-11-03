import { describe, expect, it } from "vitest";
import { setTiming } from "./set-timing";

const at = (min: number, sec = 0) =>
  new Date(Date.UTC(2026, 10, 3, 17, min, sec)).toISOString();

describe("setTiming", () => {
  it("needs two ticked sets", () => {
    expect(setTiming([])).toBeNull();
    expect(
      setTiming([{ completedAt: at(0) }, { completedAt: null }]),
    ).toBeNull();
  });

  it("sorts ticks and measures gaps, span and the cap", () => {
    const t = setTiming(
      [
        { completedAt: at(10) },
        { completedAt: at(0) },
        { completedAt: at(2, 30) },
        { completedAt: null },
        { completedAt: at(70) },
      ],
      65,
    )!;
    expect(t.timedSets).toBe(4);
    expect(t.gapsSeconds).toEqual([150, 450, 3600]);
    expect(t.medianGapSeconds).toBe(450);
    expect(t.longestGapSeconds).toBe(3600);
    expect(t.longGaps).toBe(2);
    expect(t.spanMinutes).toBe(70);
    expect(t.overCap).toBe(true);
  });

  it("averages the middle pair for an even count and has no cap by default", () => {
    const t = setTiming([
      { completedAt: at(0) },
      { completedAt: at(1) },
      { completedAt: at(4) },
    ])!;
    expect(t.medianGapSeconds).toBe(120);
    expect(t.overCap).toBe(false);
  });
});
