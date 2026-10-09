import { describe, expect, it } from "vitest";
import {
  buildLastByExercise,
  formatLastPerformance,
  startingWeight,
} from "./helpers";

function set(
  exerciseName: string,
  setNumber: number,
  weight: number | null,
  reps: number | null,
  isWarmup = false,
) {
  return { exerciseName, setNumber, weight, reps, isWarmup } as never;
}

describe("buildLastByExercise", () => {
  const sessions = [
    {
      sessionDate: "2026-10-01",
      sets: [set("Barbell Bench Press", 1, 160, 8), set("Pull-Up", 1, null, 3)],
    },
    {
      sessionDate: "2026-10-06",
      sets: [
        set("Barbell Bench Press", 1, 100, 10, true),
        set("Barbell Bench Press", 2, 165, 8),
        set("Barbell Bench Press", 1, 165, 8),
        set("Barbell Bench Press", 3, 165, 7),
      ],
    },
  ];

  it("uses the most recent session per exercise, ignoring warm-ups", () => {
    const last = buildLastByExercise(sessions);
    expect(last["barbell bench press"]?.sessionDate).toBe("2026-10-06");
    expect(last["barbell bench press"]?.sets).toEqual([
      { weight: 165, reps: 8 },
      { weight: 165, reps: 8 },
      { weight: 165, reps: 7 },
    ]);
  });

  it("falls back to an older session for exercises missing from the newest", () => {
    expect(buildLastByExercise(sessions)["pull-up"]?.sessionDate).toBe(
      "2026-10-01",
    );
  });

  it("is case and whitespace insensitive on names", () => {
    const last = buildLastByExercise([
      { sessionDate: "2026-10-06", sets: [set("  DB Curl ", 1, 20, 15)] },
    ]);
    expect(last["db curl"]).toBeDefined();
  });

  it("skips exercises that only have warm-up sets", () => {
    const last = buildLastByExercise([
      { sessionDate: "2026-10-06", sets: [set("Squat", 1, 95, 5, true)] },
    ]);
    expect(last["squat"]).toBeUndefined();
  });
});

describe("formatLastPerformance", () => {
  it("shows the weight once while it stays the same", () => {
    expect(
      formatLastPerformance({
        sessionDate: "2026-10-06",
        sets: [
          { weight: 165, reps: 8 },
          { weight: 165, reps: 8 },
          { weight: 165, reps: 7 },
        ],
      }),
    ).toBe("165 x 8, 8, 7");
  });

  it("repeats the weight when it changes and handles bodyweight", () => {
    expect(
      formatLastPerformance({
        sessionDate: "2026-10-06",
        sets: [
          { weight: 165, reps: 8 },
          { weight: 155, reps: 10 },
        ],
      }),
    ).toBe("165 x 8, 155 x 10");
    expect(
      formatLastPerformance({
        sessionDate: "2026-10-06",
        sets: [
          { weight: null, reps: 4 },
          { weight: null, reps: 3 },
        ],
      }),
    ).toBe("4, 3");
  });
});

describe("startingWeight", () => {
  const last = {
    sessionDate: "2026-10-06",
    sets: [
      { weight: 165, reps: 8 },
      { weight: 160, reps: 8 },
    ],
  };

  it("uses the same set last time, then the last set, then the template", () => {
    expect(startingWeight(last, 0, 150)).toBe("165");
    expect(startingWeight(last, 1, 150)).toBe("160");
    expect(startingWeight(last, 3, 150)).toBe("160");
    expect(startingWeight(undefined, 0, 150)).toBe("150");
    expect(startingWeight(undefined, 0, null)).toBe("");
  });

  it("falls back to the template for a bodyweight last time", () => {
    expect(
      startingWeight(
        { sessionDate: "2026-10-06", sets: [{ weight: null, reps: 3 }] },
        0,
        10,
      ),
    ).toBe("10");
  });
});
