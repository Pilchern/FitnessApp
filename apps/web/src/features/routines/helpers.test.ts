import { describe, expect, it } from "vitest";
import { ROUTINES, routineForHabit } from "../../lib/routines";
import {
  formatClock,
  positionAt,
  routineTotalSeconds,
  stepStartOffsets,
} from "./helpers";

const steps = [{ seconds: 30 }, { seconds: 45 }];

describe("positionAt", () => {
  it("starts in the prep phase of the first step", () => {
    expect(positionAt(steps, 5, 0)).toEqual({
      done: false,
      index: 0,
      phase: "prep",
      remaining: 5,
    });
  });

  it("moves into the hold after prep and counts down", () => {
    expect(positionAt(steps, 5, 5)).toEqual({
      done: false,
      index: 0,
      phase: "hold",
      remaining: 30,
    });
    expect(positionAt(steps, 5, 34.2)).toMatchObject({ remaining: 1 });
  });

  it("advances to the next step on its own", () => {
    expect(positionAt(steps, 5, 35)).toMatchObject({ index: 1, phase: "prep" });
    expect(positionAt(steps, 5, 41)).toMatchObject({
      index: 1,
      phase: "hold",
      remaining: 44,
    });
  });

  it("finishes after the last hold", () => {
    expect(positionAt(steps, 5, 85)).toEqual({ done: true });
  });
});

describe("routine timing", () => {
  it("offsets each step by the prep and holds before it", () => {
    expect(stepStartOffsets(steps, 5)).toEqual([0, 35]);
    expect(routineTotalSeconds(steps, 5)).toBe(85);
  });

  it("keeps the routines close to the plan's time budgets", () => {
    const minutes = (slug: string) =>
      routineTotalSeconds(ROUTINES.find((r) => r.slug === slug)!.steps, 5) / 60;
    // Plan doc section 6: Foundation 8-10 min, Mobility 15 min.
    expect(minutes("foundation")).toBeGreaterThanOrEqual(7);
    expect(minutes("foundation")).toBeLessThanOrEqual(10);
    expect(minutes("mobility")).toBeGreaterThanOrEqual(12);
    expect(minutes("mobility")).toBeLessThanOrEqual(16);
  });

  it("formats a countdown", () => {
    expect(formatClock(45)).toBe("45");
    expect(formatClock(75)).toBe("1:15");
  });
});

describe("routineForHabit", () => {
  it("matches the seeded habit names", () => {
    expect(routineForHabit("Mobility (15 min)")?.slug).toBe("mobility");
    expect(routineForHabit("Foundation Training (8-10 min)")?.slug).toBe(
      "foundation",
    );
    expect(routineForHabit("7,000 steps")).toBeNull();
  });

  it("never tells the user to kneel", () => {
    for (const routine of ROUTINES) {
      for (const step of routine.steps) {
        expect(`${step.name} ${step.cue}`).not.toMatch(/kneel/i);
      }
    }
  });
});
