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

const component = (r: { components: { key: string }[] }, key: string) =>
  (
    r as { components: ({ key: string } & Record<string, unknown>)[] }
  ).components.find((c) => c.key === key) as
    | {
        key: string;
        score: number;
        detail: string;
        label: string;
        weight: number;
      }
    | undefined;

const base = () => [...nights(20)];

describe("computeDailyReadiness", () => {
  it("scores a normal day in the 80s with every signal it has", () => {
    const r = scored(computeDailyReadiness([...base(), tonight()], TODAY));
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.score).toBeLessThan(90);
    expect(r.level).toBe("good");
    expect(keys(r)).toEqual([
      "hrvTrend",
      "hrvLastNight",
      "overnightHeartRate",
      "vitals",
      "sleep",
      "sleepBalance",
    ]);
    expect(r.groups.map((g) => g.group)).toEqual(["body", "sleep"]);
    expect(r.caps).toEqual([]);
    expect(r.limiters).toEqual([]);
    expect(r.calibrating).toBe(false);
    const total = r.components.reduce((s, c) => s + c.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("moves day to day instead of sitting on one number", () => {
    const a = scored(
      computeDailyReadiness([...base(), tonight({ sleepHrvAvg: 58 })], TODAY),
    );
    const b = scored(
      computeDailyReadiness([...base(), tonight({ sleepHrvAvg: 72 })], TODAY),
    );
    expect(a.score).toBeLessThan(b.score);
  });

  it("leaves HRV out until 14 baseline nights, and says so", () => {
    const r = scored(computeDailyReadiness([...nights(10), tonight()], TODAY));
    expect(keys(r)).not.toContain("hrvTrend");
    expect(keys(r)).not.toContain("hrvLastNight");
    expect(r.calibrating).toBe(true);
    expect(r.baselineDays).toBe(10);
  });

  it("counts one low HRV night, but less than a low week", () => {
    const night = scored(
      computeDailyReadiness([...base(), tonight({ sleepHrvAvg: 30 })], TODAY),
    );
    expect(component(night, "hrvLastNight")?.detail).toBe(
      "30 ms vs 65 ms usual",
    );
    expect(component(night, "hrvLastNight")!.score).toBeLessThan(50);
    expect(night.level).toBe("good");
    expect(night.limiters[0]).toMatch(/^HRV, last night/);

    const week = scored(
      computeDailyReadiness(
        [
          ...nights(26).slice(6),
          ...nights(6, { sleepHrvAvg: 38 }),
          tonight({ sleepHrvAvg: 38 }),
        ],
        TODAY,
      ),
    );
    expect(component(week, "hrvTrend")!.score).toBeLessThan(50);
    expect(week.score).toBeLessThan(night.score);
  });

  it("gives only a little credit for HRV above normal", () => {
    const r = scored(
      computeDailyReadiness(
        [
          ...nights(26).slice(6),
          ...nights(6, { sleepHrvAvg: 120 }),
          tonight({ sleepHrvAvg: 120 }),
        ],
        TODAY,
      ),
    );
    expect(component(r, "hrvTrend")!.score).toBe(90);
  });

  it("scores overnight heart rate continuously", () => {
    const normal = scored(computeDailyReadiness([...base(), tonight()], TODAY));
    const up3 = scored(
      computeDailyReadiness(
        [...base(), tonight({ sleepAvgHeartRate: 58 })],
        TODAY,
      ),
    );
    const up8 = scored(
      computeDailyReadiness(
        [...base(), tonight({ sleepAvgHeartRate: 63 })],
        TODAY,
      ),
    );
    expect(up3.score).toBeLessThan(normal.score);
    expect(up8.score).toBeLessThan(up3.score);
    expect(component(up8, "overnightHeartRate")!.score).toBeLessThan(50);
  });

  it("holds one extreme signal so it cannot zero the day", () => {
    const r = scored(
      computeDailyReadiness(
        [...base(), tonight({ sleepAvgHeartRate: 95 })],
        TODAY,
      ),
    );
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.caps).toEqual([]);
  });

  it("caps at fair when two vitals are up together", () => {
    const r = scored(
      computeDailyReadiness(
        [...base(), tonight({ sleepWristTempC: 36.8, sleepAvgHeartRate: 61 })],
        TODAY,
      ),
    );
    expect(r.score).toBeLessThanOrEqual(59);
    expect(r.level).toBe("fair");
    expect(r.caps[0]).toMatch(
      /^Vitals off: wrist temperature \+0.6 °C, overnight heart rate \+6 bpm/,
    );
  });

  it("costs a raised vital in the vitals contributor without capping", () => {
    const r = scored(
      computeDailyReadiness(
        [...base(), tonight({ sleepWristTempC: 36.8 })],
        TODAY,
      ),
    );
    expect(r.caps).toEqual([]);
    expect(component(r, "vitals")!.score).toBeLessThan(85);
    expect(component(r, "vitals")!.detail).toMatch(/temp \+0.6 °C/);
  });

  it("caps at low as possible illness on a strong rise plus another", () => {
    const r = scored(
      computeDailyReadiness(
        [
          ...base(),
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

  it("weighs a short week more than one short night", () => {
    const opts = { sleepTargetHours: 7.5 };
    const shortNight = scored(
      computeDailyReadiness(
        [...base(), tonight({ sleepDurationMinutes: 6 * 60 })],
        TODAY,
        opts,
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
        opts,
      ),
    );
    expect(shortNight.score).toBeLessThan(80);
    expect(shortWeek.score).toBeLessThan(shortNight.score);
    expect(component(shortNight, "sleep")?.detail).toBe("6 h of 7.5 h needed");
  });

  it("raises last night's sleep need after a hard training day", () => {
    const r = scored(
      computeDailyReadiness([...base(), tonight()], TODAY, {
        trimpByDate: { [shift(TODAY, -1)]: 400 },
      }),
    );
    expect(component(r, "sleep")?.detail).toMatch(/of 8\.\d h needed$/);
  });

  it("scores sleep quality and timing against your usual", () => {
    const rows = nights(20, {
      timeInBedMinutes: 510,
      deepSleepMinutes: 40,
      remSleepMinutes: 110,
      awakeMinutes: 20,
      bedtimeLocal: "21:45",
      wakeTimeLocal: "06:00",
    });
    const usual = scored(
      computeDailyReadiness(
        [
          ...rows,
          tonight({
            timeInBedMinutes: 510,
            deepSleepMinutes: 40,
            remSleepMinutes: 110,
            awakeMinutes: 20,
            bedtimeLocal: "21:45",
            wakeTimeLocal: "06:00",
          }),
        ],
        TODAY,
      ),
    );
    const rough = scored(
      computeDailyReadiness(
        [
          ...rows,
          tonight({
            timeInBedMinutes: 600,
            deepSleepMinutes: 20,
            remSleepMinutes: 60,
            awakeMinutes: 90,
            bedtimeLocal: "00:15",
            wakeTimeLocal: "06:00",
          }),
        ],
        TODAY,
      ),
    );
    expect(component(usual, "sleepQuality")!.score).toBe(80);
    expect(component(usual, "sleepTiming")?.detail).toBe(
      "bed 9:45 PM, usual time",
    );
    expect(component(rough, "sleepQuality")!.score).toBeLessThan(40);
    expect(component(rough, "sleepTiming")?.detail).toBe(
      "bed 12:15 AM, 2 h 30 min later than usual",
    );
    expect(rough.score).toBeLessThan(usual.score);
  });

  it("scores training load from yesterday and the last week", () => {
    const trimp: Record<string, number> = {};
    for (let i = 1; i <= 28; i += 1) {
      if (i % 2 === 0) trimp[shift(TODAY, -i)] = 100;
    }
    const rest = scored(
      computeDailyReadiness([...base(), tonight()], TODAY, {
        trimpByDate: trimp,
      }),
    );
    expect(component(rest, "strainYesterday")?.detail).toBe("rest day");
    expect(component(rest, "loadBalance")!.score).toBeGreaterThanOrEqual(80);

    const big = { ...trimp };
    for (let i = 1; i <= 7; i += 1) big[shift(TODAY, -i)] = 250;
    const hard = scored(
      computeDailyReadiness([...base(), tonight()], TODAY, {
        trimpByDate: big,
      }),
    );
    expect(component(hard, "strainYesterday")!.score).toBeLessThan(60);
    expect(component(hard, "loadBalance")!.score).toBeLessThan(60);
    expect(hard.score).toBeLessThan(rest.score);
    expect(hard.groups.find((g) => g.group === "load")).toBeDefined();
  });

  it("scores yesterday's fuel against target, and caps after heavy drinking", () => {
    const opts = {
      fuelTargets: {
        proteinGrams: 180,
        caloriesLiftDay: 2450,
        caloriesRestDay: 2450,
      },
    };
    const fed = scored(
      computeDailyReadiness([...base(), tonight()], TODAY, {
        ...opts,
        nutrition: [
          {
            date: shift(TODAY, -1),
            calories: 2400,
            proteinGrams: 185,
            alcoholCount: 0,
          },
        ],
      }),
    );
    const under = scored(
      computeDailyReadiness([...base(), tonight()], TODAY, {
        ...opts,
        nutrition: [
          {
            date: shift(TODAY, -1),
            calories: 1500,
            proteinGrams: 110,
            alcoholCount: 3,
          },
        ],
      }),
    );
    expect(component(fed, "fuel")?.detail).toBe(
      "2,400 kcal of 2,450, 185 g protein of 180",
    );
    expect(component(under, "fuel")!.score).toBeLessThan(20);
    expect(under.caps).toContain("3 drinks logged last night");
    expect(under.score).toBeLessThanOrEqual(59);
  });

  it("blends in how you feel at 30%, and caps on rough or very sore", () => {
    const plain = scored(computeDailyReadiness([...base(), tonight()], TODAY));
    const good = scored(
      computeDailyReadiness(
        [...base(), tonight({ readinessLevel: 10 })],
        TODAY,
      ),
    );
    expect(good.score).toBe(Math.round(0.7 * plain.score + 30));
    expect(good.components.at(-1)).toMatchObject({
      key: "feel",
      detail: "10/10",
      weight: 0.3,
    });

    const rough = scored(
      computeDailyReadiness([...base(), tonight({ readinessLevel: 2 })], TODAY),
    );
    expect(rough.score).toBeLessThanOrEqual(49);
    expect(rough.caps).toContain("You rated how you feel 2/10");

    const sore = scored(
      computeDailyReadiness([...base(), tonight({ sorenessLevel: 8 })], TODAY),
    );
    expect(sore.score).toBeLessThanOrEqual(49);
    expect(component(sore, "soreness")?.score).toBe(30);
  });

  it("uses stress, energy and the knee check when logged", () => {
    const r = scored(
      computeDailyReadiness(
        [...base(), tonight({ stressLevel: 8, energyLevel: 3 })],
        TODAY,
        {
          kneeChecks: [
            {
              date: TODAY,
              check: { swelling: "1+", graftPain: 2, extensionFull: true },
            },
          ],
        },
      ),
    );
    expect(component(r, "stress")?.score).toBe(30);
    expect(component(r, "energy")?.score).toBe(30);
    expect(component(r, "knee")?.detail).toBe("knee off");
    expect(r.caps).toContain(
      "Knee check says knee off: leg block replaced today",
    );
    expect(r.score).toBeLessThanOrEqual(59);
  });

  it("uses this morning's answers when the physiology falls back to yesterday", () => {
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
    const hr = component(r, "overnightHeartRate");
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
    expect(component(r, "overnightHeartRate")?.label).toBe("Resting HR");
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
    expect(component(aligned, "overnightHeartRate")?.detail).toBe(
      "56 bpm vs 56 usual",
    );
  });
});

describe("buildReadinessHistory", () => {
  it("returns one entry per day with nulls where unscorable", () => {
    const history = buildReadinessHistory(nights(10), TODAY, 7);
    expect(history).toHaveLength(7);
    expect(history[6]).toEqual({ date: TODAY, score: null });
    expect(history[5]?.score).toBeGreaterThan(70);
  });
});
