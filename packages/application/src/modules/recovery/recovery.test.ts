import { describe, expect, it } from "vitest";
import {
  buildRecoveryRestingHeartRateTrend,
  buildRecoverySleepTrend,
  buildRecoverySummary,
  createRecoveryCheckinSchema,
  updateRecoveryCheckinSchema,
} from "../../index";
import type { RecoveryCheckin } from "@fitness-app/domain";

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
