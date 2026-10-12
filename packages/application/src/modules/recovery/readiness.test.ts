import { describe, expect, it } from "vitest";
import type { RecoveryCheckin } from "@fitness-app/domain";
import { buildReadinessHistory, computeDailyReadiness } from "../../index";

function checkin(
  checkinDate: string,
  values: Partial<RecoveryCheckin> = {},
): RecoveryCheckin {
  return {
    id: `r-${checkinDate}`,
    userId: "11111111-1111-4111-8111-111111111111",
    checkinDate,
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
    createdAt: `${checkinDate}T00:00:00.000Z`,
    updatedAt: `${checkinDate}T00:00:00.000Z`,
    deletedAt: null,
    ...values,
  };
}

/** Ten steady baseline days ending the day before 2026-10-12. */
function baseline(days = 10) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 11 - i));
    return checkin(d.toISOString().slice(0, 10), {
      hrv: 50 + (i % 3) * 5,
      restingHeartRate: 60 + (i % 2),
      sleepDurationMinutes: 480,
    });
  });
}

const TODAY = "2026-10-12";

describe("computeDailyReadiness", () => {
  it("scores a normal day near the baseline as good", () => {
    const result = computeDailyReadiness(
      [
        ...baseline(),
        checkin(TODAY, {
          hrv: 55,
          restingHeartRate: 60,
          sleepDurationMinutes: 480,
        }),
      ],
      TODAY,
    );
    expect(result.status).toBe("scored");
    if (result.status !== "scored") return;
    expect(result.date).toBe(TODAY);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe("good");
    expect(result.components.map((c) => c.key)).toEqual([
      "hrv",
      "restingHeartRate",
      "sleep",
      "sleepBalance",
    ]);
    expect(result.calibrating).toBe(true);
    expect(result.baselineDays).toBe(10);
  });

  it("drops for suppressed HRV, raised resting HR and short sleep", () => {
    const result = computeDailyReadiness(
      [
        ...baseline(),
        checkin(TODAY, {
          hrv: 30,
          restingHeartRate: 68,
          sleepDurationMinutes: 330,
        }),
      ],
      TODAY,
    );
    expect(result.status).toBe("scored");
    if (result.status !== "scored") return;
    expect(result.level).toBe("low");
    const sleep = result.components.find((c) => c.key === "sleep");
    expect(sleep?.detail).toBe("5.5 h of 8 h");
  });

  it("does not score without a five-day baseline", () => {
    const result = computeDailyReadiness(
      [
        ...baseline(3),
        checkin(TODAY, {
          hrv: 50,
          restingHeartRate: 60,
          sleepDurationMinutes: 480,
        }),
      ],
      TODAY,
    );
    expect(result).toEqual({
      status: "insufficient",
      date: TODAY,
      reason: "Building your baseline: 3 of 5 days of HRV and resting HR.",
    });
  });

  it("falls back to yesterday when today has not synced", () => {
    const rows = baseline();
    const result = computeDailyReadiness([...rows, checkin(TODAY)], TODAY);
    expect(result.status).toBe("scored");
    if (result.status === "scored") expect(result.date).toBe("2026-10-11");
  });

  it("reports nothing synced when neither today nor yesterday has data", () => {
    const result = computeDailyReadiness([], TODAY);
    expect(result.status).toBe("insufficient");
    expect(result.date).toBeNull();
  });

  it("caps the score on high soreness or a low self-rating", () => {
    const result = computeDailyReadiness(
      [
        ...baseline(),
        checkin(TODAY, {
          hrv: 60,
          restingHeartRate: 59,
          sleepDurationMinutes: 500,
          sorenessLevel: 8,
          readinessLevel: 3,
        }),
      ],
      TODAY,
    );
    expect(result.status).toBe("scored");
    if (result.status !== "scored") return;
    expect(result.score).toBeLessThanOrEqual(49);
    expect(result.caps).toEqual([
      "Soreness logged at 8/10",
      "You rated readiness 3/10",
    ]);
  });

  it("is not thrown by one extreme HRV reading in the baseline", () => {
    const rows = baseline();
    rows[0] = { ...rows[0]!, hrv: 400 };
    const withOutlier = computeDailyReadiness(
      [...rows, checkin(TODAY, { hrv: 55, restingHeartRate: 60 })],
      TODAY,
    );
    const without = computeDailyReadiness(
      [...baseline(), checkin(TODAY, { hrv: 55, restingHeartRate: 60 })],
      TODAY,
    );
    if (withOutlier.status !== "scored" || without.status !== "scored") {
      throw new Error("expected scores");
    }
    expect(Math.abs(withOutlier.score - without.score)).toBeLessThanOrEqual(5);
  });

  it("honors a custom sleep target", () => {
    const result = computeDailyReadiness(
      [...baseline(), checkin(TODAY, { hrv: 55, sleepDurationMinutes: 420 })],
      TODAY,
      { sleepTargetHours: 7 },
    );
    if (result.status !== "scored") throw new Error("expected a score");
    expect(result.components.find((c) => c.key === "sleep")?.score).toBe(100);
  });
});

describe("buildReadinessHistory", () => {
  it("returns one entry per day with nulls where unscorable", () => {
    const history = buildReadinessHistory(baseline(), TODAY, 7);
    expect(history).toHaveLength(7);
    expect(history[6]).toEqual({ date: TODAY, score: null });
    expect(history[5]?.score).not.toBeNull();
  });
});
