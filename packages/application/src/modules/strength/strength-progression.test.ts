import { describe, expect, it } from "vitest";
import type { StrengthExerciseSet, StrengthSession } from "@fitness-app/domain";
import {
  buildStrengthProgressionSummaries,
  buildTopSetProgression,
  detectPersonalRecords,
  detectRepeatedStall,
} from "./strength-progression";

const userId = "11111111-1111-4111-8111-111111111111";

function makeSet(
  overrides: Partial<StrengthExerciseSet> = {},
): StrengthExerciseSet {
  return {
    id: `set-${Math.random()}`,
    userId,
    strengthSessionId: "session-x",
    exerciseName: "Pull-up",
    exerciseOrder: 0,
    setNumber: 1,
    reps: null,
    weight: null,
    rir: null,
    isWarmup: false,
    durationSeconds: null,
    distanceMeters: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function makeSession(
  sessionDate: string,
  sets: StrengthExerciseSet[],
): StrengthSession {
  return {
    id: `session-${sessionDate}`,
    userId,
    trainingTemplateId: null,
    sessionDate,
    sessionName: null,
    notes: null,
    durationMinutes: null,
    readinessPre: null,
    energyPost: null,
    completedAsPlanned: true,
    source: {
      sourceType: "manual",
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    },
    createdAt: `${sessionDate}T00:00:00.000Z`,
    updatedAt: `${sessionDate}T00:00:00.000Z`,
    deletedAt: null,
    sets,
  };
}

describe("buildTopSetProgression estimated-1RM calculation", () => {
  it("does not let a light, very-high-rep set outscore a genuine heavy top set", () => {
    // Regression test: the Epley-style estimate (weight * (1 + reps/30)) grows
    // without bound as reps increase, so an uncapped formula lets a 60lb x 100-rep
    // set (score 260) outscore a real 185lb x 5-rep top set (score 215.8) and get
    // flagged as a personal record it isn't.
    const sessions = [
      makeSession("2026-06-01", [
        makeSet({
          exerciseName: "Pull-up",
          weight: 185,
          reps: 5,
          setNumber: 1,
        }),
      ]),
      makeSession("2026-06-08", [
        makeSet({
          exerciseName: "Pull-up",
          weight: 60,
          reps: 100,
          setNumber: 1,
        }),
      ]),
    ];

    const topSets = buildTopSetProgression(sessions, "Pull-up");
    const heavySet = topSets.find((s) => s.sessionDate === "2026-06-01")!;
    const highRepSet = topSets.find((s) => s.sessionDate === "2026-06-08")!;

    expect(heavySet.estimatedOneRepMax).toBeGreaterThan(
      highRepSet.estimatedOneRepMax ?? Infinity,
    );

    const summaries = buildStrengthProgressionSummaries(sessions);
    const pullUpSummary = summaries.find((s) => s.exerciseName === "Pull-up")!;
    expect(pullUpSummary.isPersonalRecord).toBe(false);
  });

  it("caps the rep multiplier at reps beyond the reliable estimation range", () => {
    const sessions = [
      makeSession("2026-06-01", [
        makeSet({
          exerciseName: "Leg press",
          weight: 200,
          reps: 12,
          setNumber: 1,
        }),
      ]),
      makeSession("2026-06-08", [
        makeSet({
          exerciseName: "Leg press",
          weight: 200,
          reps: 50,
          setNumber: 1,
        }),
      ]),
    ];

    const topSets = buildTopSetProgression(sessions, "Leg press");
    const at12Reps = topSets.find((s) => s.sessionDate === "2026-06-01")!;
    const at50Reps = topSets.find((s) => s.sessionDate === "2026-06-08")!;

    // Same weight, reps capped at 12 for the formula -> identical estimate.
    expect(at50Reps.estimatedOneRepMax).toBe(at12Reps.estimatedOneRepMax);
  });

  it("still computes an uncapped estimate for realistic rep ranges", () => {
    const sessions = [
      makeSession("2026-06-01", [
        makeSet({
          exerciseName: "Bench press",
          weight: 185,
          reps: 5,
          setNumber: 1,
        }),
      ]),
    ];

    const topSets = buildTopSetProgression(sessions, "Bench press");
    // 185 * (1 + 5/30) = 215.8
    expect(topSets[0].estimatedOneRepMax).toBe(215.8);
  });
});

describe("detectPersonalRecords", () => {
  it("flags a genuine heavier weight as a weight PR", () => {
    const results = detectPersonalRecords(
      "Deadlift",
      [{ weight: 315, reps: 3 }],
      [{ weight: 300, reps: 3 }],
    );

    expect(
      results.some((r) => r.prType === "weight" && r.newValue === 315),
    ).toBe(true);
  });

  it("does not flag a lower weight as a PR", () => {
    const results = detectPersonalRecords(
      "Deadlift",
      [{ weight: 250, reps: 3 }],
      [{ weight: 300, reps: 3 }],
    );

    expect(results.some((r) => r.prType === "weight")).toBe(false);
  });
});

describe("detectRepeatedStall", () => {
  const point = (sessionDate: string, estimatedOneRepMax: number) =>
    ({
      sessionDate,
      estimatedOneRepMax,
      weight: estimatedOneRepMax,
      reps: 1,
    }) as never;

  it("does not call a clear decline 'measurable improvement'", () => {
    // Was compared against the window's MAX, which included the baseline
    // itself and so was always >= it. A mid-window spike therefore masked the
    // regression: 200 -> 205 -> 180 reported stalled: false with "still show
    // measurable improvement", to a lifter whose latest top set was 20 below
    // where the window started.
    const result = detectRepeatedStall([
      point("2026-03-17", 200),
      point("2026-03-24", 205),
      point("2026-03-31", 180),
    ]);

    expect(result.stalled).toBe(true);
    expect(result.explanation).not.toContain("improvement");
    expect(result.explanation).toContain("trended down");
  });

  it("still reports genuine progress as not stalled", () => {
    const result = detectRepeatedStall([
      point("2026-03-17", 200),
      point("2026-03-24", 205),
      point("2026-03-31", 210),
    ]);

    expect(result.stalled).toBe(false);
    expect(result.stagnantSessions).toBe(0);
  });

  it("reports a recovery to above baseline as not stalled", () => {
    // Dipped mid-window but finished ahead — that is progress, not a stall.
    const result = detectRepeatedStall([
      point("2026-03-17", 200),
      point("2026-03-24", 180),
      point("2026-03-31", 205),
    ]);

    expect(result.stalled).toBe(false);
  });

  it("treats a flat window as a plateau, not a decline", () => {
    const result = detectRepeatedStall([
      point("2026-03-17", 200),
      point("2026-03-24", 200),
      point("2026-03-31", 200),
    ]);

    expect(result.stalled).toBe(true);
    expect(result.explanation).toContain("not improved meaningfully");
  });

  it("ignores movement smaller than the noise threshold", () => {
    const result = detectRepeatedStall([
      point("2026-03-17", 200),
      point("2026-03-24", 200.2),
      point("2026-03-31", 200.4),
    ]);

    expect(result.stalled).toBe(true);
    expect(result.explanation).toContain("not improved meaningfully");
  });

  it("only considers the most recent three sessions", () => {
    // A long-ago low start must not make a currently-flat lifter look like
    // they are still progressing.
    const result = detectRepeatedStall([
      point("2026-02-01", 100),
      point("2026-03-17", 200),
      point("2026-03-24", 200),
      point("2026-03-31", 200),
    ]);

    expect(result.stalled).toBe(true);
  });

  it("declines to judge fewer than three sessions", () => {
    const result = detectRepeatedStall([
      point("2026-03-17", 200),
      point("2026-03-24", 180),
    ]);

    expect(result.stalled).toBe(false);
    expect(result.stagnantSessions).toBe(2);
    expect(result.explanation).toContain("at least 3 sessions");
  });
});
