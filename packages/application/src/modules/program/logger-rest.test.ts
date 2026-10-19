import { describe, expect, it } from "vitest";
import { restForTick, restMetaFromPlan } from "./program-logger-plan";

describe("program rest on tick (supersets and per-leg)", () => {
  const meta = restMetaFromPlan([
    {
      exerciseName: "Step-Up",
      exerciseOrder: 0,
      targetSets: 3,
      targetReps: 12,
      targetWeight: null,
      targetRir: 2,
      notes: null,
      program: true,
      sideMode: "per_leg",
      category: "main",
      supersetGroup: "A",
      supersetOrder: 1,
    },
    {
      exerciseName: "Pull-Up",
      exerciseOrder: 1,
      targetSets: 4,
      targetReps: 6,
      targetWeight: null,
      targetRir: 1,
      notes: null,
      program: true,
      category: "main",
      supersetGroup: "A",
      supersetOrder: 2,
    },
    {
      exerciseName: "Curl",
      exerciseOrder: 2,
      targetSets: 2,
      targetReps: 15,
      targetWeight: null,
      targetRir: 2,
      notes: null,
      program: true,
      category: "accessory",
    },
  ]);
  const sets = (done: boolean[]) =>
    [
      { exerciseName: "Step-Up", side: "left" as const },
      { exerciseName: "Step-Up", side: "right" as const },
      { exerciseName: "Pull-Up", side: "" as const },
      { exerciseName: "Step-Up", side: "left" as const },
      { exerciseName: "Step-Up", side: "right" as const },
      { exerciseName: "Pull-Up", side: "" as const },
      { exerciseName: "Curl", side: "" as const },
    ].map((s, i) => ({ ...s, done: done[i] ?? false }));

  it("left leg goes straight to the right leg", () => {
    expect(restForTick(sets([]), 0, meta)).toEqual({
      seconds: 0,
      next: "Right leg",
    });
  });

  it("A1 right leg goes straight to A2, A2 rests 90 s for the pair", () => {
    expect(restForTick(sets([true]), 1, meta)).toEqual({
      seconds: 0,
      next: "Next: A2 Pull-Up",
    });
    expect(restForTick(sets([true, true]), 2, meta)).toEqual({
      seconds: 90,
      next: "Then A1 Step-Up",
    });
  });

  it("an extra A2 set after A1 is finished rests like a straight set", () => {
    expect(
      restForTick(sets([true, true, true, true, true]), 5, meta)?.seconds,
    ).toBe(150);
  });

  it("straight program rows rest by category; free rows return null", () => {
    expect(restForTick(sets([]), 6, meta)?.seconds).toBe(60);
    expect(
      restForTick([{ exerciseName: "Other", side: "", done: false }], 0, meta),
    ).toBeNull();
  });
});
