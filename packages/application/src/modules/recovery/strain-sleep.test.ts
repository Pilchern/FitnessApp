import { describe, expect, it } from "vitest";
import {
  banisterTrimp,
  buildDailyStrain,
  buildSleepPlan,
  estimatedMaxHeartRate,
  strainFromTrimp,
  zone2HeartRateRange,
} from "../../index";

describe("heart rate zones", () => {
  it("uses Tanaka max HR and 60-70% for Zone 2", () => {
    expect(estimatedMaxHeartRate(36)).toBe(183);
    expect(zone2HeartRateRange(36)).toEqual([110, 128]);
  });
});

describe("strain", () => {
  const context = {
    restingHeartRate: 60,
    maxHeartRate: 183,
    sex: "male" as const,
  };

  it("scores a 45 min Zone 2 ride with Banister TRIMP", () => {
    const trimp = banisterTrimp({ minutes: 45, avgHeartRate: 120, ...context });
    expect(trimp).toBeCloseTo(35.84, 1);
    expect(strainFromTrimp(trimp)).toBe(4.5);
    expect(strainFromTrimp(0)).toBe(0);
    expect(strainFromTrimp(10_000)).toBe(21);
  });

  it("sums a day's sessions and counts ones without heart rate", () => {
    const days = buildDailyStrain(
      ["2026-10-12", "2026-10-13"],
      [
        {
          sessionDate: "2026-10-13",
          durationMinutes: 45,
          avgHeartRate: 120,
          plannedVsCompleted: "completed",
          sportType: "Indoor Cycling",
        },
        {
          sessionDate: "2026-10-13",
          durationMinutes: 30,
          avgHeartRate: 130,
          plannedVsCompleted: "skipped",
          sportType: null,
        },
      ],
      [
        { sessionDate: "2026-10-13", durationMinutes: 60, avgHeartRate: 95 },
        { sessionDate: "2026-10-12", durationMinutes: 50, avgHeartRate: null },
      ],
      context,
    );
    expect(days[0]).toMatchObject({
      date: "2026-10-12",
      strain: 0,
      unscored: 1,
    });
    expect(days[1]).toMatchObject({
      date: "2026-10-13",
      strain: 6.4,
      trimp: 55,
    });
    expect(days[1]?.sessions.map((s) => s.label)).toEqual([
      "Indoor Cycling",
      "Lift",
    ]);
  });
});

describe("buildSleepPlan", () => {
  const row = (
    checkinDate: string,
    hours: number,
    wakeTimeLocal: string | null = null,
  ) => ({
    checkinDate,
    sleepDurationMinutes: hours * 60,
    timeInBedMinutes: null,
    wakeTimeLocal,
  });

  const plan = buildSleepPlan({
    checkins: [
      row("2026-10-13", 7, "06:30"),
      row("2026-10-12", 7, "06:30"),
      row("2026-10-11", 8, "07:30"),
      row("2026-10-10", 7, "06:30"),
      row("2026-10-09", 8),
    ],
    today: "2026-10-13",
    sleepTargetHours: 8,
    strainByDate: new Map([["2026-10-12", 10.5]]),
    wakeTarget: "06:30",
    earliestBedtime: "21:45",
  });

  it("scores last night against a need raised by strain and debt", () => {
    // 8 h + 10.5/21 x 0.75 h strain + min(1 h, half of 2 h debt).
    expect(plan.lastNight).toEqual({
      sleptHours: 7,
      needHours: 9.4,
      performancePct: 75,
    });
  });

  it("plans tonight and holds lights-out at the plan's floor", () => {
    expect(plan.tonight).toEqual({
      needHours: 9,
      debtHours: 1,
      strainHours: 0,
      inBedBy: "9:45 PM",
    });
    expect(plan.wakeSpreadMinutes).toBe(26);
  });

  it("leaves last night empty before the sleep sync", () => {
    const early = buildSleepPlan({
      checkins: [],
      today: "2026-10-13",
      sleepTargetHours: 8,
      strainByDate: new Map(),
      wakeTarget: "06:30",
      earliestBedtime: "21:45",
    });
    expect(early.lastNight).toBeNull();
    // 8 h at the default 92% efficiency: 8.7 h in bed, 9:48 PM.
    expect(early.tonight.inBedBy).toBe("9:48 PM");
  });
});
