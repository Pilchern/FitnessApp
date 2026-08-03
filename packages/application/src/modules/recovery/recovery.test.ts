import { describe, expect, it } from "vitest";
import {
  buildRecoveryRestingHeartRateTrend,
  buildRecoverySleepTrend,
  buildRecoverySummary,
  createRecoveryCheckinSchema,
  getRecoveryCoachingSuggestion,
  updateRecoveryCheckinSchema,
} from "../../index";
import type { RecoveryCheckin } from "@fitness-app/domain";

function makeCheckin(
  overrides: Partial<RecoveryCheckin> = {},
): RecoveryCheckin {
  return {
    id: "recovery-x",
    userId,
    checkinDate: "2026-03-24",
    restingHeartRate: null,
    hrv: null,
    sleepDurationMinutes: null,
    sleepQuality: null,
    energyLevel: null,
    readinessLevel: null,
    stressLevel: null,
    sorenessLevel: null,
    alcoholCount: 0,
    notes: null,
    timeInBedMinutes: null,
    sleepEfficiencyPct: null,
    deepSleepMinutes: null,
    remSleepMinutes: null,
    coreSleepMinutes: null,
    awakeMinutes: null,
    sleepRespiratoryRate: null,
    sleepSpo2AvgPct: null,
    sleepHrvAvg: null,
    sleepAvgHeartRate: null,
    bedtimeLocal: null,
    wakeTimeLocal: null,
    coldPlungeCompleted: null,
    source: {
      sourceType: "manual",
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    },
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

const userId = "11111111-1111-4111-8111-111111111111";

describe("recovery validation", () => {
  it("accepts 1-10 readiness/stress/soreness scores", () => {
    const parsed = createRecoveryCheckinSchema.parse({
      userId,
      checkinDate: "2026-03-31",
      sleepQuality: 4,
      readinessLevel: 8,
      stressLevel: 3,
      sorenessLevel: 5,
      alcoholCount: 0,
    });

    expect(parsed.readinessLevel).toBe(8);
    expect(parsed.stressLevel).toBe(3);
    expect(parsed.sorenessLevel).toBe(5);
  });

  it("rejects soreness above 10 on update", () => {
    expect(() =>
      updateRecoveryCheckinSchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
        userId,
        sorenessLevel: 11,
      }),
    ).toThrow();
  });

  it("rejects a resting heart rate that is obviously a data-entry error", () => {
    expect(() =>
      createRecoveryCheckinSchema.parse({
        userId,
        checkinDate: "2026-03-31",
        alcoholCount: 0,
        restingHeartRate: 9999,
      }),
    ).toThrow();
  });

  it("rejects an HRV value that is obviously a data-entry error", () => {
    expect(() =>
      createRecoveryCheckinSchema.parse({
        userId,
        checkinDate: "2026-03-31",
        alcoholCount: 0,
        hrv: 50000,
      }),
    ).toThrow();
  });

  it("rejects an alcoholCount that is obviously a data-entry error", () => {
    expect(() =>
      createRecoveryCheckinSchema.parse({
        userId,
        checkinDate: "2026-03-31",
        alcoholCount: 500,
      }),
    ).toThrow();
  });

  it("accepts HH:MM bedtime/wake time and a cold plunge flag", () => {
    const parsed = createRecoveryCheckinSchema.parse({
      userId,
      checkinDate: "2026-03-31",
      alcoholCount: 0,
      bedtimeLocal: "22:45",
      wakeTimeLocal: "06:30",
      coldPlungeCompleted: true,
    });

    expect(parsed.bedtimeLocal).toBe("22:45");
    expect(parsed.wakeTimeLocal).toBe("06:30");
    expect(parsed.coldPlungeCompleted).toBe(true);
  });

  it("accepts HH:MM:SS bedtime/wake time (the shape Postgres `time` round-trips as)", () => {
    const parsed = createRecoveryCheckinSchema.parse({
      userId,
      checkinDate: "2026-03-31",
      alcoholCount: 0,
      bedtimeLocal: "22:45:00",
      wakeTimeLocal: "06:30:15",
    });

    expect(parsed.bedtimeLocal).toBe("22:45:00");
    expect(parsed.wakeTimeLocal).toBe("06:30:15");
  });

  it("rejects malformed bedtime/wake time strings", () => {
    expect(() =>
      createRecoveryCheckinSchema.parse({
        userId,
        checkinDate: "2026-03-31",
        alcoholCount: 0,
        bedtimeLocal: "10:45pm",
      }),
    ).toThrow();

    expect(() =>
      createRecoveryCheckinSchema.parse({
        userId,
        checkinDate: "2026-03-31",
        alcoholCount: 0,
        wakeTimeLocal: "25:00",
      }),
    ).toThrow();
  });
});

describe("recovery helpers", () => {
  const checkins: RecoveryCheckin[] = [
    {
      id: "recovery-1",
      userId,
      checkinDate: "2026-03-24",
      restingHeartRate: 56,
      hrv: 47,
      sleepDurationMinutes: 450,
      sleepQuality: 4,
      energyLevel: null,
      readinessLevel: 8,
      stressLevel: 3,
      sorenessLevel: 4,
      alcoholCount: 0,
      notes: null,
      timeInBedMinutes: null,
      sleepEfficiencyPct: null,
      deepSleepMinutes: null,
      remSleepMinutes: null,
      coreSleepMinutes: null,
      awakeMinutes: null,
      sleepRespiratoryRate: null,
      sleepSpo2AvgPct: null,
      sleepHrvAvg: null,
      sleepAvgHeartRate: null,
      bedtimeLocal: null,
      wakeTimeLocal: null,
      coldPlungeCompleted: null,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "recovery-2",
      userId,
      checkinDate: "2026-03-25",
      restingHeartRate: null,
      hrv: null,
      sleepDurationMinutes: null,
      sleepQuality: null,
      energyLevel: null,
      readinessLevel: 6,
      stressLevel: 6,
      sorenessLevel: 5,
      alcoholCount: 1,
      notes: null,
      timeInBedMinutes: null,
      sleepEfficiencyPct: null,
      deepSleepMinutes: null,
      remSleepMinutes: null,
      coreSleepMinutes: null,
      awakeMinutes: null,
      sleepRespiratoryRate: null,
      sleepSpo2AvgPct: null,
      sleepHrvAvg: null,
      sleepAvgHeartRate: null,
      bedtimeLocal: null,
      wakeTimeLocal: null,
      coldPlungeCompleted: null,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:00:00.000Z",
      deletedAt: null,
    },
  ];

  it("builds recovery summary without blowing up on missing values", () => {
    expect(buildRecoverySummary(checkins)).toEqual({
      averageSleepHours: 7.5,
      averageSleepEfficiency: null,
      averageReadiness: 7,
      averageStress: 4.5,
      averageSoreness: 4.5,
      totalAlcoholCount: 1,
      averageRestingHeartRate: 56,
      averageHrv: 47,
    });
  });

  it("builds sparse-safe trends by filtering missing values", () => {
    expect(buildRecoverySleepTrend(checkins)).toEqual([
      { date: "2026-03-24", value: 7.5 },
    ]);
    expect(buildRecoveryRestingHeartRateTrend(checkins)).toEqual([
      { date: "2026-03-24", value: 56 },
    ]);
  });
});

describe("getRecoveryCoachingSuggestion", () => {
  it("returns null when there are no check-ins", () => {
    expect(getRecoveryCoachingSuggestion([])).toBeNull();
  });

  it("warns on severe soreness even when readiness looks fine", () => {
    const suggestion = getRecoveryCoachingSuggestion([
      makeCheckin({ readinessLevel: 8, sorenessLevel: 9 }),
    ]);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.severity).toBe("warning");
    expect(suggestion?.headline).toMatch(/soreness/i);
  });

  it("warns on low readiness", () => {
    const suggestion = getRecoveryCoachingSuggestion([
      makeCheckin({ readinessLevel: 2, sorenessLevel: 3 }),
    ]);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.severity).toBe("warning");
    expect(suggestion?.headline).toMatch(/readiness/i);
  });

  it("returns null for an unremarkable check-in", () => {
    const suggestion = getRecoveryCoachingSuggestion([
      makeCheckin({ readinessLevel: 8, sorenessLevel: 3, hrv: null }),
    ]);

    expect(suggestion).toBeNull();
  });
});
