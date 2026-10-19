import { describe, expect, it } from "vitest";
import type { RecoveryCheckin } from "@fitness-app/domain";
import {
  buildReadinessHistory,
  computeDailyReadiness,
  type DailyReadiness,
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

const TODAY = "2026-10-12";

function shift(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Steady nights ending the day before TODAY: overnight HRV 60-70 ms, HR
 * 55-56, 8 h asleep, wrist temp 36.2, breathing 15.
 */
function nights(days: number, values: Partial<RecoveryCheckin> = {}) {
  return Array.from({ length: days }, (_, i) =>
    checkin(shift(TODAY, -(i + 1)), {
      hrv: 50,
      restingHeartRate: 60,
      sleepHrvAvg: 60 + (i % 3) * 5,
      sleepAvgHeartRate: 55 + (i % 2),
      sleepDurationMinutes: 480,
      sleepWristTempC: 36.2,
      sleepRespiratoryRate: 15,
      overnightWindow: "sleep",
      ...values,
    }),
  );
}

/** Tonight: a normal night unless overridden. */
function tonight(values: Partial<RecoveryCheckin> = {}) {
  return checkin(TODAY, {
    hrv: 50,
    restingHeartRate: 60,
    sleepHrvAvg: 65,
    sleepAvgHeartRate: 55,
    sleepDurationMinutes: 480,
    sleepWristTempC: 36.2,
    sleepRespiratoryRate: 15,
    overnightWindow: "sleep",
    ...values,
  });
}

function scored(result: DailyReadiness) {
  if (result.status !== "scored") throw new Error("expected a score");
  return result;
}

const keys = (r: { components: { key: string }[] }) =>
  r.components.map((c) => c.key);

describe("computeDailyReadiness", () => {
  it("scores a normal day 80, good", () => {
    const r = scored(computeDailyReadiness([...nights(20), tonight()], TODAY));
    expect(r.score).toBe(80);
    expect(r.level).toBe("good");
    expect(keys(r)).toEqual([
      "hrvTrend",
      "overnightHeartRate",
      "sleep",
      "sleepBalance",
    ]);
    expect(r.caps).toEqual([]);
    expect(r.calibrating).toBe(false);
  });

  it("leaves HRV out until 14 baseline nights, and says so", () => {
    const r = scored(computeDailyReadiness([...nights(10), tonight()], TODAY));
    expect(keys(r)).not.toContain("hrvTrend");
    expect(r.calibrating).toBe(true);
    expect(r.baselineDays).toBe(10);
    expect(r.score).toBe(80);
  });

  it("does not move on one low HRV night", () => {
    const r = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ sleepHrvAvg: 30 })],
        TODAY,
      ),
    );
    expect(r.score).toBe(80);
    expect(r.components.find((c) => c.key === "hrvTrend")?.detail).toMatch(
      /last night 30 ms$/,
    );
  });

  it("drops when the 7-night HRV trend falls below normal", () => {
    const low = nights(6, { sleepHrvAvg: 38 });
    const base = nights(26).slice(6);
    const r = scored(
      computeDailyReadiness(
        [...base, ...low, tonight({ sleepHrvAvg: 38 })],
        TODAY,
      ),
    );
    const hrv = r.components.find((c) => c.key === "hrvTrend");
    expect(hrv?.level).toBe("low");
    expect(r.score).toBeLessThan(67);
  });

  it("gives no credit for HRV above normal", () => {
    const high = nights(6, { sleepHrvAvg: 120 });
    const base = nights(26).slice(6);
    const r = scored(
      computeDailyReadiness(
        [...base, ...high, tonight({ sleepHrvAvg: 120 })],
        TODAY,
      ),
    );
    expect(r.components.find((c) => c.key === "hrvTrend")?.score).toBe(80);
  });

  it("treats overnight HR within about 3 bpm as normal", () => {
    const r = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ sleepAvgHeartRate: 58 })],
        TODAY,
      ),
    );
    expect(r.score).toBe(80);
    const up = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ sleepAvgHeartRate: 63 })],
        TODAY,
      ),
    );
    expect(up.score).toBeLessThan(80);
    expect(up.level).toBe("good");
  });

  it("holds one extreme signal so it cannot zero the day", () => {
    const r = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ sleepAvgHeartRate: 95 })],
        TODAY,
      ),
    );
    // HR +40 is a full deficit at 30% weight, then the vitals check alone
    // does not cap it (one signal).
    expect(r.score).toBe(62);
    expect(r.caps).toEqual([]);
  });

  it("caps at fair when two vitals are up together", () => {
    const r = scored(
      computeDailyReadiness(
        [
          ...nights(20),
          tonight({ sleepWristTempC: 36.8, sleepAvgHeartRate: 61 }),
        ],
        TODAY,
      ),
    );
    expect(r.score).toBeLessThanOrEqual(59);
    expect(r.level).toBe("fair");
    expect(r.caps[0]).toMatch(
      /^Vitals off: wrist temperature \+0.6 °C, overnight heart rate \+6 bpm/,
    );
  });

  it("does not cap on one raised vital alone", () => {
    const r = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ sleepWristTempC: 36.8 })],
        TODAY,
      ),
    );
    expect(r.caps).toEqual([]);
    expect(r.score).toBe(80);
  });

  it("caps at low as possible illness on a strong rise plus another", () => {
    const r = scored(
      computeDailyReadiness(
        [
          ...nights(20),
          tonight({ sleepWristTempC: 37.3, sleepRespiratoryRate: 16.2 }),
        ],
        TODAY,
      ),
    );
    expect(r.score).toBeLessThanOrEqual(45);
    expect(r.caps[0]).toMatch(
      /^Possible illness: wrist temperature \+1.1 °C, breathing rate \+1.2\/min/,
    );
  });

  it("weighs a short week more than one short night, with no credit above target", () => {
    const shortNight = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ sleepDurationMinutes: 6 * 60 })],
        TODAY,
        { sleepTargetHours: 7.5 },
      ),
    );
    const shortWeek = scored(
      computeDailyReadiness(
        [
          ...nights(6, { sleepDurationMinutes: 390 }),
          ...nights(26).slice(6),
          tonight({ sleepDurationMinutes: 390 }),
        ],
        TODAY,
        { sleepTargetHours: 7.5 },
      ),
    );
    const long = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ sleepDurationMinutes: 600 })],
        TODAY,
        { sleepTargetHours: 7.5 },
      ),
    );
    expect(shortNight.level).toBe("good");
    expect(shortNight.score).toBeLessThan(80);
    expect(shortWeek.score).toBeLessThan(shortNight.score);
    expect(shortWeek.level).toBe("fair");
    expect(long.score).toBe(80);
    expect(shortNight.components.find((c) => c.key === "sleep")?.detail).toBe(
      "6 h of 7.5 h",
    );
  });

  it("blends in how you feel at 35%, and caps on rough or very sore", () => {
    const good = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ readinessLevel: 10 })],
        TODAY,
      ),
    );
    expect(good.score).toBe(Math.round(0.65 * 80 + 35));
    expect(good.components.at(-1)).toMatchObject({
      key: "feel",
      detail: "10/10",
    });

    const meh = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ readinessLevel: 4 })],
        TODAY,
      ),
    );
    expect(meh.level).toBe("fair");

    const rough = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ readinessLevel: 2 })],
        TODAY,
      ),
    );
    expect(rough.score).toBeLessThanOrEqual(49);
    expect(rough.caps).toContain("You rated how you feel 2/10");

    const sore = scored(
      computeDailyReadiness(
        [...nights(20), tonight({ sorenessLevel: 8 })],
        TODAY,
      ),
    );
    expect(sore.score).toBeLessThanOrEqual(49);
  });

  it("uses this morning's rating when the physiology falls back to yesterday", () => {
    const rows = nights(20);
    rows[0] = { ...rows[0]!, readinessLevel: 2 };
    const r = scored(
      computeDailyReadiness(
        [...rows, checkin(TODAY, { readinessLevel: 8 })],
        TODAY,
      ),
    );
    expect(r.date).toBe(shift(TODAY, -1));
    expect(r.components.at(-1)?.detail).toBe("8/10");
    expect(r.caps).toEqual([]);
  });

  it("does not score without a five-night baseline", () => {
    expect(computeDailyReadiness([...nights(3), tonight()], TODAY)).toEqual({
      status: "insufficient",
      date: TODAY,
      reason: "Building your baseline: 3 of 5 nights of HRV and heart rate.",
    });
  });

  it("reports nothing synced when neither today nor yesterday has data", () => {
    const result = computeDailyReadiness([], TODAY);
    expect(result.status).toBe("insufficient");
    expect(result.date).toBeNull();
  });

  it("uses daily resting HR until five overnight nights exist", () => {
    const rows = nights(20, { sleepAvgHeartRate: null });
    const r = scored(computeDailyReadiness([...rows, tonight()], TODAY));
    const hr = r.components.find((c) => c.key === "overnightHeartRate");
    expect(hr?.label).toBe("Resting HR");
    expect(hr?.detail).toBe("60 bpm vs 60 usual");
  });

  it("skips fixed-window overnight readings when sleep started after 23:30", () => {
    const rows = nights(20, { overnightWindow: null, bedtimeLocal: "22:00" });
    // A 00:15 bedtime: the 23:00-05:59 window caught an awake hour.
    const late = tonight({
      overnightWindow: null,
      bedtimeLocal: "00:15",
      sleepAvgHeartRate: 85,
      sleepRespiratoryRate: 17,
    });
    const r = scored(computeDailyReadiness([...rows, late], TODAY));
    expect(
      r.components.find((c) => c.key === "overnightHeartRate")?.label,
    ).toBe("Resting HR");
    expect(r.caps).toEqual([]);

    // Averaged over the time asleep, a late night's readings are used.
    const aligned = scored(
      computeDailyReadiness(
        [
          ...rows,
          { ...late, overnightWindow: "sleep" as const, sleepAvgHeartRate: 56 },
        ],
        TODAY,
      ),
    );
    expect(
      aligned.components.find((c) => c.key === "overnightHeartRate")?.detail,
    ).toBe("56 bpm vs 56 usual");
  });
});

describe("buildReadinessHistory", () => {
  it("returns one entry per day with nulls where unscorable", () => {
    const history = buildReadinessHistory(nights(10), TODAY, 7);
    expect(history).toHaveLength(7);
    expect(history[6]).toEqual({ date: TODAY, score: null });
    expect(history[5]?.score).toBe(80);
  });
});
