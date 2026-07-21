import { describe, expect, it } from "vitest";
import type { StrengthExerciseSet, StrengthSession } from "@fitness-app/domain";
import { computeMuscleGroupVolume } from "./muscle-group-volume";

function makeSet(partial: Partial<StrengthExerciseSet>): StrengthExerciseSet {
  return {
    id: "set-1",
    userId: "user-1",
    strengthSessionId: "session-1",
    exerciseName: "Barbell Bench Press",
    exerciseOrder: 0,
    setNumber: 1,
    reps: 8,
    weight: 135,
    rir: 2,
    isWarmup: false,
    notes: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    deletedAt: null,
    ...partial,
  };
}

function makeSession(
  partial: Partial<StrengthSession> & { sets: StrengthExerciseSet[] },
): StrengthSession {
  return {
    id: "session-1",
    userId: "user-1",
    trainingTemplateId: null,
    sessionDate: "2026-07-15",
    sessionName: null,
    notes: null,
    durationMinutes: 45,
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
    createdAt: "2026-07-15T00:00:00Z",
    updatedAt: "2026-07-15T00:00:00Z",
    deletedAt: null,
    ...partial,
  };
}

describe("computeMuscleGroupVolume", () => {
  it("excludes sessions outside the requested date range", () => {
    const outOfRange = makeSession({
      sessionDate: "2026-01-01",
      sets: [makeSet({})],
    });

    const summary = computeMuscleGroupVolume([outOfRange], {
      startDate: "2026-07-01",
      endDate: "2026-07-21",
    });

    const chest = summary.byMuscleGroup.find((g) => g.muscleGroup === "chest");
    expect(chest?.workingSetCount).toBe(0);
  });

  it("excludes warm-up sets from working volume", () => {
    const session = makeSession({
      sets: [
        makeSet({ id: "w1", isWarmup: true, weight: 95, reps: 5 }),
        makeSet({ id: "s1", isWarmup: false, weight: 135, reps: 8 }),
      ],
    });

    const summary = computeMuscleGroupVolume([session], {
      startDate: "2026-07-01",
      endDate: "2026-07-21",
    });

    const chest = summary.byMuscleGroup.find((g) => g.muscleGroup === "chest");
    expect(chest?.workingSetCount).toBe(1);
    expect(chest?.totalVolume).toBe(135 * 8);
  });

  it("flags muscle groups with zero working sets as neglected", () => {
    const session = makeSession({
      sets: [makeSet({ exerciseName: "Barbell Bench Press" })],
    });

    const summary = computeMuscleGroupVolume([session], {
      startDate: "2026-07-01",
      endDate: "2026-07-21",
    });

    expect(summary.neglectedMuscleGroups).toContain("back");
    expect(summary.neglectedMuscleGroups).not.toContain("chest");
  });

  it("computes a push:pull volume ratio when both sides have data", () => {
    const session = makeSession({
      sets: [
        makeSet({
          id: "p1",
          exerciseName: "Barbell Bench Press",
          weight: 135,
          reps: 10,
        }), // push, 1350
        makeSet({
          id: "p2",
          exerciseName: "Barbell Row",
          weight: 135,
          reps: 10,
        }), // pull, 1350
      ],
    });

    const summary = computeMuscleGroupVolume([session], {
      startDate: "2026-07-01",
      endDate: "2026-07-21",
    });

    expect(summary.pushPullVolumeRatio).toBe(1);
  });

  it("counts sets for unrecognized exercises as unclassified instead of dropping them", () => {
    const session = makeSession({
      sets: [makeSet({ exerciseName: "Some Custom Cable Thing" })],
    });

    const summary = computeMuscleGroupVolume([session], {
      startDate: "2026-07-01",
      endDate: "2026-07-21",
    });

    expect(summary.unclassifiedWorkingSetCount).toBe(1);
    expect(summary.byMuscleGroup.every((g) => g.workingSetCount === 0)).toBe(
      true,
    );
  });
});
