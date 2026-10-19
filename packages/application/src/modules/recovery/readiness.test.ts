import { describe, expect, it } from "vitest";
import type { RecoveryCheckin } from "@fitness-app/domain";
import {
  buildReadinessHistory,
  buildTrainingLoad,
  computeDailyReadiness,
  plannedWeeklyLoad,
} from "../../index";

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
    sleepWristTempC: null,
    overnightWindow: null,
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

function shift(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A baseline past the 14-day calibration, with a steady 06:30 wake. */
function settledBaseline(days = 20) {
  return baseline(days).map((r) => ({ ...r, wakeTimeLocal: "06:30" }));
}

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
    expect(result.score).toBeGreaterThanOrEqual(67);
    expect(result.score).toBeLessThanOrEqual(80);
    expect(result.level).toBe("good");
    expect(result.components.map((c) => c.key)).toEqual([
      "hrv",
      "hrvBalance",
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

  it("scores the 7-night HRV median, robust to one odd night", () => {
    const balance = (rows: ReturnType<typeof baseline>) => {
      const result = computeDailyReadiness(
        [...rows, checkin(TODAY, { hrv: 55, restingHeartRate: 60 })],
        TODAY,
      );
      if (result.status !== "scored") throw new Error("expected a score");
      return result.components.find((c) => c.key === "hrvBalance");
    };

    // A steady week sits at baseline.
    expect(balance(baseline())?.score).toBe(70);

    // One crashed night in the week barely moves it.
    const oneBad = baseline();
    oneBad[0] = { ...oneBad[0]!, hrv: 25 };
    expect(balance(oneBad)?.score).toBeGreaterThanOrEqual(65);

    // A week of suppressed HRV reads low even when tonight is normal.
    const suppressed = baseline(20).map((r, i) =>
      i < 6 ? { ...r, hrv: 38 } : r,
    );
    const week = balance(suppressed);
    expect(week?.level).toBe("low");
    // The low nights sit in the 30-day baseline too, so "usual" eases to 50.
    expect(week?.detail).toBe("38 ms typical vs 50 ms usual");

    // Needs three nights in the week.
    const sparse = baseline().map((r, i) => (i < 6 ? { ...r, hrv: null } : r));
    expect(balance(sparse)).toBeUndefined();
  });

  it("treats one slightly short night gently and a short week harder", () => {
    const sleepScore = (minutes: number, rows = baseline()) => {
      const result = computeDailyReadiness(
        [...rows, checkin(TODAY, { hrv: 55, sleepDurationMinutes: minutes })],
        TODAY,
      );
      if (result.status !== "scored") throw new Error("expected a score");
      const score = (key: string) =>
        result.components.find((c) => c.key === key)?.score;
      return { sleep: score("sleep"), week: score("sleepBalance") };
    };

    // 15 min short is free; 7.3 h is fair, not low; 6 h is low.
    expect(sleepScore(465).sleep).toBe(70);
    expect(sleepScore(438)).toEqual({ sleep: 62, week: 70 });
    expect(sleepScore(360).sleep).toBe(39);
    // Floored at -3 SD so one very short night cannot zero the contributor.
    expect(sleepScore(180).sleep).toBe(4);

    // A full week at 7 h reads low on the 7-night average.
    const shortWeek = baseline().map((r) => ({
      ...r,
      sleepDurationMinutes: 420,
    }));
    expect(sleepScore(420, shortWeek)).toEqual({ sleep: 57, week: 48 });
  });

  it("honors a custom sleep target", () => {
    const result = computeDailyReadiness(
      [...baseline(), checkin(TODAY, { hrv: 55, sleepDurationMinutes: 420 })],
      TODAY,
      { sleepTargetHours: 7 },
    );
    if (result.status !== "scored") throw new Error("expected a score");
    expect(result.components.find((c) => c.key === "sleep")?.score).toBe(70);
  });

  it("reaches 100 only with every signal above a settled baseline", () => {
    const rows = settledBaseline();
    const peak = checkin(TODAY, {
      hrv: 80,
      restingHeartRate: 55,
      sleepDurationMinutes: 540,
      wakeTimeLocal: "06:30",
    });
    const best = computeDailyReadiness([...rows, peak], TODAY);
    if (best.status !== "scored") throw new Error("expected a score");
    expect(best.score).toBe(100);
    expect(best.components.map((c) => c.key)).toEqual([
      "hrv",
      "hrvBalance",
      "restingHeartRate",
      "sleep",
      "sleepBalance",
      "wakeConsistency",
    ]);

    // Resting HR a beat above usual: still great, but not 100.
    const nearly = computeDailyReadiness(
      [...rows, { ...peak, restingHeartRate: 62 }],
      TODAY,
    );
    if (nearly.status !== "scored") throw new Error("expected a score");
    expect(nearly.score).toBeLessThanOrEqual(99);

    // The same night on a 10-day baseline tops out at 95.
    const early = computeDailyReadiness([...settledBaseline(10), peak], TODAY);
    if (early.status !== "scored") throw new Error("expected a score");
    expect(early.calibrating).toBe(true);
    expect(early.score).toBe(95);
  });

  it("prefers overnight HRV and heart rate once five nights exist", () => {
    const rows = settledBaseline().map((r) => ({
      ...r,
      sleepHrvAvg: 70,
      sleepAvgHeartRate: 52,
    }));
    const result = computeDailyReadiness(
      [
        ...rows,
        checkin(TODAY, {
          hrv: 55,
          restingHeartRate: 60,
          sleepHrvAvg: 50,
          sleepAvgHeartRate: 58,
          sleepDurationMinutes: 480,
        }),
      ],
      TODAY,
    );
    if (result.status !== "scored") throw new Error("expected a score");
    const hrv = result.components.find((c) => c.key === "hrv");
    expect(hrv?.label).toBe("HRV, overnight");
    expect(hrv?.detail).toBe("50 ms vs 70 ms usual");
    expect(
      result.components.find((c) => c.key === "restingHeartRate")?.label,
    ).toBe("Heart rate, overnight");
    expect(result.level).toBe("low");
  });

  it("ignores overnight readings on a night with no sleep recorded", () => {
    const rows = settledBaseline().map((r) => ({
      ...r,
      sleepHrvAvg: 70,
      sleepAvgHeartRate: 52,
    }));
    const result = computeDailyReadiness(
      [
        ...rows,
        checkin(TODAY, {
          hrv: 55,
          restingHeartRate: 60,
          sleepAvgHeartRate: 116,
        }),
      ],
      TODAY,
    );
    if (result.status !== "scored") throw new Error("expected a score");
    const hr = result.components.find((c) => c.key === "restingHeartRate");
    expect(hr?.label).toBe("Resting HR");
    expect(hr?.detail).toBe("60 bpm vs 61 usual");
  });

  it("skips overnight readings when sleep started after 23:30", () => {
    const rows = settledBaseline().map((r) => ({
      ...r,
      bedtimeLocal: "22:00",
      sleepHrvAvg: 70,
      sleepAvgHeartRate: 52,
      sleepRespiratoryRate: 14,
    }));
    // A 00:15 bedtime: the 23:00-05:59 window caught an awake hour.
    const late = checkin(TODAY, {
      restingHeartRate: 60,
      sleepDurationMinutes: 450,
      bedtimeLocal: "00:15",
      sleepHrvAvg: 40,
      sleepAvgHeartRate: 85,
      sleepRespiratoryRate: 17,
    });
    const result = computeDailyReadiness([...rows, late], TODAY);
    if (result.status !== "scored") throw new Error("expected a score");
    expect(result.components.find((c) => c.key === "hrv")).toBeUndefined();
    const hr = result.components.find((c) => c.key === "restingHeartRate");
    expect(hr?.label).toBe("Resting HR");
    expect(result.adjustments).toEqual([]);
    expect(result.level).toBe("good");

    // Averaged over the time asleep, a late night's readings are used.
    const aligned = computeDailyReadiness(
      [
        ...rows,
        { ...late, overnightWindow: "sleep" as const, sleepAvgHeartRate: 53 },
      ],
      TODAY,
    );
    if (aligned.status !== "scored") throw new Error("expected a score");
    expect(
      aligned.components.find((c) => c.key === "restingHeartRate")?.detail,
    ).toBe("53 bpm vs 52 usual");
    expect(aligned.components.find((c) => c.key === "hrv")?.label).toBe(
      "HRV, overnight",
    );

    // 23:20 is still inside the clean window.
    const onTime = computeDailyReadiness(
      [...rows, { ...late, bedtimeLocal: "23:20" }],
      TODAY,
    );
    if (onTime.status !== "scored") throw new Error("expected a score");
    expect(
      onTime.components.find((c) => c.key === "restingHeartRate")?.label,
    ).toBe("Heart rate, overnight");
  });

  it("holds one extreme signal to 3 z so it cannot zero the day", () => {
    const rows = settledBaseline();
    const day = checkin(TODAY, {
      hrv: 55,
      restingHeartRate: 60,
      sleepDurationMinutes: 480,
      wakeTimeLocal: "06:30",
    });
    const spike = computeDailyReadiness(
      [...rows, { ...day, restingHeartRate: 90 }],
      TODAY,
    );
    const high = computeDailyReadiness(
      [...rows, { ...day, restingHeartRate: 70 }],
      TODAY,
    );
    if (spike.status !== "scored" || high.status !== "scored") {
      throw new Error("expected scores");
    }
    // 10 bpm over is already past 3 z; 30 bpm over costs no more.
    expect(spike.score).toBe(high.score);
    expect(spike.score).toBeGreaterThanOrEqual(50);
  });

  it("scores wake-time consistency over the last 7 days", () => {
    const rows = settledBaseline().map((r, i) => ({
      ...r,
      wakeTimeLocal: i % 2 === 0 ? "05:30" : "07:45",
    }));
    const result = computeDailyReadiness(
      [...rows, checkin(TODAY, { hrv: 55, sleepDurationMinutes: 480 })],
      TODAY,
    );
    if (result.status !== "scored") throw new Error("expected a score");
    const wake = result.components.find((c) => c.key === "wakeConsistency");
    expect(wake?.detail).toBe("±68 min");
    expect(wake?.level).toBe("low");
  });

  it("subtracts for raised wrist temperature and breathing rate", () => {
    const rows = settledBaseline().map((r) => ({
      ...r,
      sleepWristTempC: 34.5,
      sleepRespiratoryRate: 14,
    }));
    const normal = checkin(TODAY, {
      hrv: 55,
      restingHeartRate: 60,
      sleepDurationMinutes: 480,
      sleepWristTempC: 34.6,
      sleepRespiratoryRate: 14.2,
    });
    const calm = computeDailyReadiness([...rows, normal], TODAY);
    const sick = computeDailyReadiness(
      [...rows, { ...normal, sleepWristTempC: 35.3, sleepRespiratoryRate: 16 }],
      TODAY,
    );
    if (calm.status !== "scored" || sick.status !== "scored") {
      throw new Error("expected scores");
    }
    expect(calm.adjustments).toEqual([]);
    expect(sick.adjustments.map((a) => [a.key, a.points])).toEqual([
      ["wristTemperature", 20],
      ["respiratoryRate", 20],
    ]);
    expect(sick.adjustments[0]?.detail).toBe("+0.8 °C above usual");
    expect(calm.score - sick.score).toBe(40);
  });

  it("subtracts for a training-load spike against the 4-week average", () => {
    const rows = settledBaseline();
    const day = checkin(TODAY, {
      hrv: 55,
      restingHeartRate: 60,
      sleepDurationMinutes: 480,
    });
    // Three 30 min Zone 2 rides a week for four weeks: 360 load a week.
    const steady = Array.from({ length: 28 }, (_, i) => i)
      .filter((i) => i % 7 === 1 || i % 7 === 3 || i % 7 === 5)
      .map((i) => ({
        sessionDate: shift(TODAY, -(i + 1)),
        sessionKind: "zone2" as const,
        durationMinutes: 30,
        rpe: null,
        plannedVsCompleted: "completed" as const,
      }));
    const calm = computeDailyReadiness([...rows, day], TODAY, {
      trainingLoad: buildTrainingLoad(steady, []),
    });
    // Plus three 60 min lifts in the last week.
    const lifts = [1, 3, 5].map((d) => ({
      sessionDate: shift(TODAY, -d),
      durationMinutes: 60,
    }));
    const spiked = computeDailyReadiness([...rows, day], TODAY, {
      trainingLoad: buildTrainingLoad(steady, lifts),
    });
    if (calm.status !== "scored" || spiked.status !== "scored") {
      throw new Error("expected scores");
    }
    expect(calm.adjustments).toEqual([]);
    const load = spiked.adjustments.find((a) => a.key === "trainingLoad");
    expect(load?.detail).toBe("last 7 days 2.3x your 4-week average");
    expect(load?.points).toBe(15);
  });

  it("does not count ramping up to the plan's weekly load as a spike", () => {
    const rows = settledBaseline();
    const day = checkin(TODAY, {
      hrv: 55,
      restingHeartRate: 60,
      sleepDurationMinutes: 480,
    });
    // Light Zone 2 for four weeks, then the plan's three lifts last week.
    const light = Array.from({ length: 28 }, (_, i) => i)
      .filter((i) => i % 7 === 1 || i % 7 === 3 || i % 7 === 5)
      .map((i) => ({
        sessionDate: shift(TODAY, -(i + 1)),
        sessionKind: "zone2" as const,
        durationMinutes: 15,
        rpe: null,
        plannedVsCompleted: "completed" as const,
      }));
    const lifts = [1, 3, 5].map((d) => ({
      sessionDate: shift(TODAY, -d),
      durationMinutes: 60,
    }));
    const planned = plannedWeeklyLoad({ liftsPerWeek: 3, zone2Minutes: 140 });
    expect(planned).toBe(1640);
    const result = computeDailyReadiness([...rows, day], TODAY, {
      trainingLoad: buildTrainingLoad(light, lifts),
      plannedWeeklyLoad: planned,
    });
    if (result.status !== "scored") throw new Error("expected a score");
    expect(result.adjustments).toEqual([]);
  });
});

describe("buildTrainingLoad", () => {
  it("sums RPE x minutes per day and skips planned or skipped rides", () => {
    expect(
      buildTrainingLoad(
        [
          {
            sessionDate: "2026-10-10",
            sessionKind: "zone2",
            durationMinutes: 45,
            rpe: null,
            plannedVsCompleted: "completed",
          },
          {
            sessionDate: "2026-10-10",
            sessionKind: "vo2",
            durationMinutes: 20,
            rpe: 9,
            plannedVsCompleted: "completed",
          },
          {
            sessionDate: "2026-10-11",
            sessionKind: "zone2",
            durationMinutes: 30,
            rpe: null,
            plannedVsCompleted: "skipped",
          },
        ],
        [{ sessionDate: "2026-10-09", durationMinutes: null }],
      ),
    ).toEqual([
      { date: "2026-10-09", load: 360 },
      { date: "2026-10-10", load: 360 },
    ]);
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
