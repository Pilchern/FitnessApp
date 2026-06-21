import { describe, expect, it } from "vitest";
import type { BodyMetric, CardioSession, RecoveryCheckin } from "@fitness-app/domain";
import {
  buildWeeklyReviewSummary,
  calculateWeeklyReviewScore,
  getLastCompletedWeekStart,
  getWeekRangeFromStart,
} from "../../index";

const userId = "11111111-1111-4111-8111-111111111111";

describe("weekly review aggregation", () => {
  it("builds a weekly summary from cardio, recovery, body metrics, and lift counts", () => {
    const bodyMetrics: BodyMetric[] = [
      {
        id: "metric-1",
        userId,
        measuredOn: "2026-03-23",
        weightLb: 190.2,
        weightKg: null,
        waistIn: 34.6,
        waistCm: null,
        bodyFatPct: null,
        muscleMassLb: null,
        muscleMassKg: null,
        boneMassKg: null,
        boneMassLb: null,
        fatFreeMassKg: null,
        fatFreeMassLb: null,
        hydrationPct: null,
        visceralFatIndex: null,
        notes: null,
        source: {
          sourceType: "manual",
          sourceProvider: null,
          sourceExternalId: null,
          importBatchId: null,
          rawImportEventId: null,
        },
        createdAt: "2026-03-23T00:00:00.000Z",
        updatedAt: "2026-03-23T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "metric-2",
        userId,
        measuredOn: "2026-03-29",
        weightLb: 189.4,
        weightKg: null,
        waistIn: 34.3,
        waistCm: null,
        bodyFatPct: null,
        muscleMassLb: null,
        muscleMassKg: null,
        boneMassKg: null,
        boneMassLb: null,
        fatFreeMassKg: null,
        fatFreeMassLb: null,
        hydrationPct: null,
        visceralFatIndex: null,
        notes: null,
        source: {
          sourceType: "manual",
          sourceProvider: null,
          sourceExternalId: null,
          importBatchId: null,
          rawImportEventId: null,
        },
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
        deletedAt: null,
      },
    ];

    const cardioSessions: CardioSession[] = [
      {
        id: "ride-1",
        userId,
        trainingTemplateId: null,
        sessionDate: "2026-03-24",
        startedAt: null,
        endedAt: null,
        sessionKind: "zone2",
        plannedVsCompleted: "completed",
        durationMinutes: 50,
        zone2Minutes: 45,
        avgHeartRate: null,
        maxHeartRate: null,
        avgOutput: null,
        cadenceMin: null,
        cadenceMax: null,
        resistanceMin: null,
        resistanceMax: null,
        intervalStructure: null,
        rpe: null,
        distanceMeters: null,
        notes: null,
        sportType: null,
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
        id: "ride-2",
        userId,
        trainingTemplateId: null,
        sessionDate: "2026-03-26",
        startedAt: null,
        endedAt: null,
        sessionKind: "vo2",
        plannedVsCompleted: "completed",
        durationMinutes: 36,
        zone2Minutes: 12,
        avgHeartRate: null,
        maxHeartRate: null,
        avgOutput: null,
        cadenceMin: null,
        cadenceMax: null,
        resistanceMin: null,
        resistanceMax: null,
        intervalStructure: null,
        rpe: null,
        distanceMeters: null,
        notes: null,
        sportType: null,
        source: {
          sourceType: "manual",
          sourceProvider: null,
          sourceExternalId: null,
          importBatchId: null,
          rawImportEventId: null,
        },
        createdAt: "2026-03-26T00:00:00.000Z",
        updatedAt: "2026-03-26T00:00:00.000Z",
        deletedAt: null,
      },
    ];

    const recoveryCheckins: RecoveryCheckin[] = [
      {
        id: "recovery-1",
        userId,
        checkinDate: "2026-03-24",
        restingHeartRate: null,
        hrv: null,
        sleepDurationMinutes: 450,
        sleepQuality: 4,
        energyLevel: null,
        readinessLevel: 8,
        stressLevel: 3,
        sorenessLevel: 4,
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
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "recovery-2",
        userId,
        checkinDate: "2026-03-26",
        restingHeartRate: null,
        hrv: null,
        sleepDurationMinutes: 420,
        sleepQuality: 3,
        energyLevel: null,
        readinessLevel: 6,
        stressLevel: 5,
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
        createdAt: "2026-03-26T00:00:00.000Z",
        updatedAt: "2026-03-26T00:00:00.000Z",
        deletedAt: null,
      },
    ];

    expect(
      buildWeeklyReviewSummary({
        bodyMetrics,
        cardioSessions,
        recoveryCheckins,
        liftsCompleted: 3,
      }),
    ).toEqual({
      averageWeightLb: 189.8,
      waistIn: 34.3,
      liftsCompleted: 3,
      ridesCompleted: 2,
      zone2Minutes: 57,
      vo2Completed: true,
      sleepAverageHours: 7.3,
      alcoholTotal: 1,
      averageReadiness: 7,
    });
  });

  it("builds week ranges and defaults to the last completed week", () => {
    expect(getWeekRangeFromStart("2026-03-23")).toEqual({
      weekStart: "2026-03-23",
      weekEnd: "2026-03-29",
    });
    expect(getLastCompletedWeekStart(new Date("2026-03-31T12:00:00-05:00"))).toBe(
      "2026-03-23",
    );
  });
});

describe("weekly review scoring", () => {
  it("scores strong adherence and recovery highly", () => {
    const result = calculateWeeklyReviewScore({
      summary: {
        liftsCompleted: 3,
        ridesCompleted: 3,
        zone2Minutes: 105,
        vo2Completed: true,
        sleepAverageHours: 7.4,
        alcoholTotal: 1,
      },
      confidence: 8,
    });

    expect(result.scoreDetails.totalScore).toBe(94);
    expect(result.scoreDetails.band).toBe("strong");
    expect(result.strategicDecision).toMatch(/Hold the plan/);
    expect(result.riskForecast).toMatch(/Low risk/);
  });

  it("flags fragile weeks with poor recovery or low confidence", () => {
    const result = calculateWeeklyReviewScore({
      summary: {
        liftsCompleted: 1,
        ridesCompleted: 1,
        zone2Minutes: 35,
        vo2Completed: false,
        sleepAverageHours: 6.1,
        alcoholTotal: 7,
      },
      confidence: 3,
    });

    expect(result.scoreDetails.totalScore).toBe(31);
    expect(result.scoreDetails.band).toBe("fragile");
    expect(result.strategicDecision).toMatch(/Protect recovery/);
    expect(result.riskForecast).toMatch(/High risk/);
  });
});
