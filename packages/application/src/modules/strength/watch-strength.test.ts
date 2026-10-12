import { describe, expect, it } from "vitest";
import {
  combineWatchWorkoutsByDate,
  isWatchOnlySession,
  planWatchStrengthMerge,
  WatchStrengthSyncService,
  type WatchStrengthRepository,
  type WatchStrengthWorkout,
} from "./watch-strength";

const workout: WatchStrengthWorkout = {
  externalId: "W1",
  workoutType: "Traditional Strength Training",
  localDate: "2026-10-12",
  startedAt: "2026-10-12T17:30:00-05:00",
  endedAt: "2026-10-12T18:20:00-05:00",
  durationMinutes: 50,
  avgHeartRate: 110,
  maxHeartRate: 150,
  activeEnergyKcal: 320,
};

const session = {
  id: "s1",
  createdAt: "2026-10-12T23:00:00Z",
  durationMinutes: null as number | null,
  avgHeartRate: null as number | null,
  maxHeartRate: null as number | null,
  activeEnergyKcal: null as number | null,
};

describe("planWatchStrengthMerge", () => {
  it("creates when nothing was logged that day", () => {
    expect(planWatchStrengthMerge([], workout)).toEqual({ kind: "create" });
  });

  it("patches the earliest session with the Watch's values", () => {
    const later = { ...session, id: "s2", createdAt: "2026-10-12T23:30:00Z" };
    expect(planWatchStrengthMerge([later, session], workout)).toEqual({
      kind: "patch",
      sessionId: "s1",
      patch: {
        startedAt: workout.startedAt,
        endedAt: workout.endedAt,
        durationMinutes: 50,
        avgHeartRate: 110,
        maxHeartRate: 150,
        activeEnergyKcal: 320,
      },
    });
  });

  it("replaces a copied duration with the measured one", () => {
    const plan = planWatchStrengthMerge(
      [{ ...session, durationMinutes: 75, avgHeartRate: 110 }],
      workout,
      { s1: "2026-10-12T22:30:00+00:00" },
    );
    expect(plan).toEqual({
      kind: "patch",
      sessionId: "s1",
      patch: { durationMinutes: 50, maxHeartRate: 150, activeEnergyKcal: 320 },
    });
  });

  it("is a no-op on an identical resend, whatever the timestamp format", () => {
    const merged = {
      ...session,
      durationMinutes: 50,
      avgHeartRate: 110,
      maxHeartRate: 150,
      activeEnergyKcal: 320,
    };
    expect(
      planWatchStrengthMerge([merged], workout, {
        s1: "2026-10-12T22:30:00+00:00",
      }),
    ).toEqual({ kind: "none" });
  });

  it("leaves a value the Watch lacks alone", () => {
    const plan = planWatchStrengthMerge(
      [{ ...session, durationMinutes: 50, maxHeartRate: 140 }],
      { ...workout, maxHeartRate: null, avgHeartRate: null },
      { s1: workout.startedAt },
    );
    expect(plan).toEqual({
      kind: "patch",
      sessionId: "s1",
      patch: { activeEnergyKcal: 320 },
    });
  });
});

describe("combineWatchWorkoutsByDate", () => {
  it("folds two workouts on one day into one span", () => {
    const warmup: WatchStrengthWorkout = {
      ...workout,
      externalId: "W0",
      workoutType: "Functional Strength Training",
      startedAt: "2026-10-12T17:15:00-05:00",
      endedAt: "2026-10-12T17:25:00-05:00",
      durationMinutes: 10,
      avgHeartRate: 95,
      maxHeartRate: 120,
      activeEnergyKcal: 40,
    };
    const other = { ...workout, externalId: "W2", localDate: "2026-10-13" };
    const out = combineWatchWorkoutsByDate([workout, warmup, other]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      ...warmup,
      endedAt: workout.endedAt,
      durationMinutes: 60,
      avgHeartRate: 108,
      maxHeartRate: 150,
      activeEnergyKcal: 360,
    });
    expect(out[1]).toEqual(other);
  });
});

describe("WatchStrengthSyncService", () => {
  function repository(
    overrides: Partial<WatchStrengthRepository> = {},
  ): WatchStrengthRepository & { created: number } {
    const repo = {
      created: 0,
      listByDateRange: async () => [],
      startedAtByIds: async () => ({}),
      patchWatchFields: async () => {},
      createFromWatch: async () => {
        repo.created += 1;
        return {} as never;
      },
      hasExternalId: async () => false,
      ...overrides,
    };
    return repo;
  }

  it("creates a Watch-only session and skips a malformed workout", async () => {
    const repo = repository();
    const result = await new WatchStrengthSyncService(repo).sync(
      "00000000-0000-4000-8000-000000000001",
      [workout, { ...workout, avgHeartRate: 400 }],
    );
    expect(result).toEqual({ patched: 0, created: 1, unchanged: 1 });
  });

  it("does not bring back a Watch-only session the user deleted", async () => {
    const repo = repository({ hasExternalId: async () => true });
    const result = await new WatchStrengthSyncService(repo).sync(
      "00000000-0000-4000-8000-000000000001",
      [workout],
    );
    expect(result).toEqual({ patched: 0, created: 0, unchanged: 1 });
    expect(repo.created).toBe(0);
  });
});

describe("isWatchOnlySession", () => {
  const source = {
    sourceType: "imported" as const,
    sourceProvider: "apple_health",
    sourceExternalId: "W1",
    importBatchId: null,
    rawImportEventId: null,
  };
  it("is true only for an imported Apple Health session with no sets", () => {
    expect(isWatchOnlySession({ sets: [], source })).toBe(true);
    expect(isWatchOnlySession({ sets: [{} as never], source })).toBe(false);
  });
});
