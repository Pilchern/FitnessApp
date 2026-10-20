import { describe, expect, it } from "vitest";
import { buildWeeklyWeightTrend } from "../body-metrics/body-metric-helpers";
import {
  countLifts,
  dayStreak,
  executionBanner,
  liftWeekOverWeek,
  metricScore,
  nutritionWeek,
  pickWeeklyFocus,
  readinessCounts,
  sleepWeek,
  weekAdherence,
  weekStreak,
  weeklySummaryText,
  type FocusMetric,
} from "./weekly-review";
import { programCalendarEvents, toIcs, zonedTimeToUtc } from "./program-ics";
import {
  DEFAULT_PROGRAM_SETTINGS,
  programSettingsFromRows,
} from "./program-settings";
import { testProgram, withGate } from "./program-fixtures.test-helpers";

const WEEK = [
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
  "2026-10-25",
];

describe("adherence scorecard", () => {
  it("counts days done in the week against the settings targets", () => {
    const a = weekAdherence({
      weekDates: WEEK,
      liftDates: new Set(["2026-10-19", "2026-10-21", "2026-10-12"]),
      rideDates: new Set(["2026-10-20", "2026-10-22", "2026-10-24"]),
      romDates: new Set(WEEK.slice(0, 5)),
      pt: { attended: 1, scheduled: 2 },
    });
    expect(a).toEqual({
      lifts: { done: 2, target: 3 },
      rides: { done: 3, target: 3 },
      romDays: { done: 5, target: 7 },
      pt: { attended: 1, scheduled: 2 },
    });
  });

  it("counts linked lifts once per program session, so two on one day count twice", () => {
    const a = weekAdherence({
      weekDates: WEEK,
      liftDates: new Set(["2026-10-23"]),
      linkedLifts: [
        // Monday's session logged late on Wednesday, plus Wednesday's own.
        { date: "2026-10-21", programSessionId: "mon" },
        { date: "2026-10-21", programSessionId: "wed" },
        // Last week's: outside this week.
        { date: "2026-10-16", programSessionId: "fri" },
      ],
      rideDates: new Set(),
      romDates: new Set(),
    });
    expect(a.lifts.done).toBe(3);
    expect(countLifts(WEEK, new Set(["2026-10-19", "2026-10-21"]))).toBe(2);
  });

  it("counts a linked lift plus a manual lift on the same day once, as the card does", () => {
    expect(
      countLifts(WEEK, new Set(["2026-10-19"]), [
        { date: "2026-10-19", programSessionId: "mon" },
      ]),
    ).toBe(1);
  });

  it("defaults scheduled PT visits to the setting until entered", () => {
    const a = weekAdherence({
      weekDates: WEEK,
      liftDates: new Set(),
      rideDates: new Set(),
      romDates: new Set(),
      settings: { ...DEFAULT_PROGRAM_SETTINGS, ptVisitsPerWeek: 3 },
    });
    expect(a.pt).toEqual({ attended: null, scheduled: 3 });
  });
});

describe("streaks", () => {
  it("counts full weeks in a row, newest first", () => {
    expect(weekStreak([3, 3, 2, 3], 3)).toBe(2);
    expect(weekStreak([2, 3], 3)).toBe(0);
    expect(weekStreak([], 3)).toBe(0);
  });

  it("counts days in a row ending today, or yesterday before today's entry", () => {
    const days = new Set(["2026-10-17", "2026-10-18", "2026-10-19"]);
    expect(dayStreak(days, "2026-10-19")).toBe(3);
    expect(dayStreak(days, "2026-10-20")).toBe(3);
    expect(dayStreak(days, "2026-10-21")).toBe(0);
  });
});

describe("execution banner", () => {
  it("shows after two completed weeks short of 3 leg sessions", () => {
    expect(executionBanner([2, 1, 3], 3, 2)).toBe(true);
    expect(executionBanner([2, 3], 3, 2)).toBe(false);
    expect(executionBanner([3, 2], 3, 2)).toBe(false);
  });

  it("waits until there are enough completed weeks", () => {
    expect(executionBanner([1], 3, 2)).toBe(false);
    expect(executionBanner([], 3, 2)).toBe(false);
  });
});

describe("nutrition week", () => {
  const isLiftDay = (d: string) => ["2026-10-19", "2026-10-21"].includes(d);
  const log = (
    logDate: string,
    proteinGrams: number | null,
    calories: number | null,
    extra: Partial<{ creatineTaken: boolean; protein50By9am: boolean }> = {},
  ) => ({
    logDate,
    proteinGrams,
    calories,
    creatineTaken: extra.creatineTaken ?? null,
    protein50By9am: extra.protein50By9am ?? null,
  });

  it("averages protein and calories with per-day calorie targets", () => {
    const w = nutritionWeek({
      logs: [
        log("2026-10-19", 170, 2500, {
          creatineTaken: true,
          protein50By9am: true,
        }),
        log("2026-10-20", 150, 2100, { creatineTaken: true }),
        log("2026-10-21", 160, null),
        log("2026-10-12", 50, 1000),
      ],
      weekDates: WEEK,
      isLiftDay,
      proteinTarget: 180,
    });
    expect(w).toEqual({
      daysLogged: 3,
      proteinAvg: 160,
      proteinTarget: 180,
      proteinFlag: false,
      caloriesAvg: 2300,
      // lift day 2450 (midpoint of 2400-2500), rest day 2200
      caloriesTargetAvg: 2325,
      creatineDays: 2,
      protein50Days: 1,
    });
  });

  it("flags a week whose protein averages under 160 g", () => {
    const w = nutritionWeek({
      logs: [log("2026-10-19", 150, null), log("2026-10-20", 168, null)],
      weekDates: WEEK,
      isLiftDay,
      proteinTarget: 180,
    });
    expect(w.proteinAvg).toBe(159);
    expect(w.proteinFlag).toBe(true);
  });

  it("has no averages without numbers", () => {
    const w = nutritionWeek({
      logs: [],
      weekDates: WEEK,
      isLiftDay,
      proteinTarget: null,
    });
    expect(w).toMatchObject({
      proteinAvg: null,
      proteinFlag: false,
      caloriesAvg: null,
    });
  });
});

describe("sleep week", () => {
  it("averages hours and quality and flags under 7 h", () => {
    const s = sleepWeek(
      [
        {
          checkinDate: "2026-10-19",
          sleepDurationMinutes: 400,
          sleepQuality: 3,
        },
        {
          checkinDate: "2026-10-20",
          sleepDurationMinutes: 420,
          sleepQuality: 4,
        },
        {
          checkinDate: "2026-10-21",
          sleepDurationMinutes: null,
          sleepQuality: null,
        },
      ],
      WEEK,
    );
    expect(s).toEqual({
      nights: 2,
      avgHours: 6.8,
      avgQuality: 3.5,
      flag: true,
    });
    expect(sleepWeek([], WEEK)).toMatchObject({ avgHours: null, flag: false });
  });
});

describe("body weight rule", () => {
  const weigh = (dates: string[], lb: number) =>
    dates.map((measuredOn) => ({ measuredOn, weightLb: lb }));
  const days = (start: number) =>
    [0, 1, 2].map((i) => `2026-10-${String(start + i).padStart(2, "0")}`);
  // Three weeks of three weigh-ins: 178, 178.7, 179.4 (+0.7 lb/week twice).
  const metrics = [
    ...weigh(days(1), 178),
    ...weigh(days(8), 178.7),
    ...weigh(days(15), 179.4),
  ];

  it("fires when the 7-day average rose over 0.5 lb/week two weeks running", () => {
    expect(buildWeeklyWeightTrend(metrics, "2026-10-21").surplusThrottle).toBe(
      true,
    );
  });

  it("follows the settings for the rate and the number of weeks", () => {
    expect(
      buildWeeklyWeightTrend(metrics, "2026-10-21", { riseLbPerWeek: 0.8 })
        .surplusThrottle,
    ).toBe(false);
    expect(
      buildWeeklyWeightTrend(metrics, "2026-10-21", { weeks: 3 })
        .surplusThrottle,
    ).toBe(false);
  });
});

describe("readiness counts", () => {
  it("tallies the week's knee checks", () => {
    expect(
      readinessCounts([
        "normal",
        "normal",
        "hold",
        "knee_off",
        null,
        null,
        null,
      ]),
    ).toEqual({
      normal: 2,
      hold: 1,
      kneeOff: 1,
      unchecked: 3,
    });
  });
});

describe("leg lift progress", () => {
  const set = (name: string, weight: number, side?: "left" | "right") =>
    ({
      exerciseName: name,
      weight,
      reps: 10,
      rir: 2,
      isWarmup: false,
      side,
    }) as never;
  const sessions = [
    {
      sessionDate: "2026-10-12",
      sets: [
        set("Goblet Box Squat", 35),
        set("Cuff Knee Extension", 5, "left"),
        set("Cuff Knee Extension", 5, "right"),
      ],
    },
    {
      sessionDate: "2026-10-19",
      sets: [
        set("Goblet Box Squat", 40),
        set("Cuff Knee Extension", 7.5, "left"),
        set("Cuff Knee Extension", 10, "right"),
      ],
    },
  ];

  it("compares this week's top load with last week's, L/R for per-leg", () => {
    const rows = liftWeekOverWeek(
      sessions,
      [
        { name: "Goblet Box Squat", perLeg: false },
        { name: "Cuff Knee Extension", perLeg: true },
        { name: "Hip Thrust", perLeg: false },
      ],
      { start: "2026-10-19", end: "2026-10-25" },
    );
    expect(rows).toEqual([
      {
        name: "Goblet Box Squat",
        perLeg: false,
        thisWeek: { load: 40, left: null, right: null },
        lastWeek: { load: 35, left: null, right: null },
      },
      {
        name: "Cuff Knee Extension",
        perLeg: true,
        thisWeek: { load: null, left: 7.5, right: 10 },
        lastWeek: { load: null, left: 5, right: 5 },
      },
    ]);
  });
});

describe("next week's focus", () => {
  const m = (
    key: string,
    actual: number | null,
    target: number | null,
    lowerIsBetter = false,
  ): FocusMetric => ({
    key,
    label: key,
    actual,
    target,
    lowerIsBetter,
    advice: "",
  });

  it("scores against target, capped at on-target", () => {
    expect(metricScore(m("x", 2, 3))).toBeCloseTo(0.667);
    expect(metricScore(m("x", 4, 3))).toBe(1);
    expect(metricScore(m("asym", 10, 5, true))).toBe(0.5);
    expect(metricScore(m("asym", 4, 5, true))).toBe(1);
    expect(metricScore(m("x", null, 3))).toBeNull();
  });

  it("picks the single metric furthest below target", () => {
    expect(
      pickWeeklyFocus([
        m("lifts", 2, 3),
        m("protein", 140, 180),
        m("rom", 3, 7),
      ])?.key,
    ).toBe("rom");
  });

  it("breaks ties by priority order and skips missing data", () => {
    expect(
      pickWeeklyFocus([m("lifts", 2, 3), m("rides", 2, 3), m("pt", null, 2)])
        ?.key,
    ).toBe("lifts");
  });

  it("is null when everything is on target", () => {
    expect(
      pickWeeklyFocus([m("lifts", 3, 3), m("asym", 4, 5, true)]),
    ).toBeNull();
  });
});

describe("summary text", () => {
  it("formats the week as plain text for LifeOS", () => {
    const text = weeklySummaryText({
      week: 9,
      weekStart: "2026-10-19",
      weekEnd: "2026-10-25",
      blockName: "On-ramp",
      nextBlock: { name: "Block 1 Build", date: "2026-10-26" },
      adherence: {
        lifts: { done: 3, target: 3 },
        rides: { done: 2, target: 3 },
        romDays: { done: 6, target: 7 },
        pt: { attended: 2, scheduled: 2 },
      },
      liftStreakWeeks: 1,
      romStreakDays: 4,
      readiness: { normal: 5, hold: 1, kneeOff: 0, unchecked: 1 },
      lifts: [
        {
          name: "Cuff Knee Extension",
          perLeg: true,
          thisWeek: { load: null, left: 7.5, right: 10 },
          lastWeek: { load: null, left: null, right: null },
        },
      ],
      quadSets: { done: 10, min: 12, max: 16 },
      nutrition: {
        daysLogged: 6,
        proteinAvg: 158,
        proteinTarget: 180,
        proteinFlag: true,
        caloriesAvg: null,
        caloriesTargetAvg: null,
        creatineDays: 6,
        protein50Days: 3,
      },
      weight: { sevenDayAvgLb: 178.2, weekOverWeekLb: 0.4 },
      sleep: { nights: 7, avgHours: 7.3, avgQuality: null, flag: false },
      quadLsiPct: 68,
      walkingAsymmetryPct: 14,
      focus: {
        key: "rides",
        label: "Peloton rides",
        actual: 2,
        target: 3,
        advice: "Book all three.",
      },
    });
    expect(text).toContain(
      "Post-op week 9 · On-ramp (2026-10-19 to 2026-10-25)",
    );
    expect(text).toContain("Next block: Block 1 Build on 2026-10-26");
    expect(text).toContain(
      "Leg sessions 3/3, Peloton 2/3, ROM check 6/7 days, PT 2/2",
    );
    expect(text).toContain(
      "Cuff Knee Extension: L 7.5 / R 10 lb (last week L – / R –)",
    );
    expect(text).toContain("Protein avg 158 g (target 180 g) LOW");
    expect(text).toContain("Weight 7-day avg 178.2 lb (+0.4 lb vs last week)");
    expect(text).toContain("Quad LSI 68%, walking asymmetry 14%");
    expect(text).toContain("Next week's focus: Peloton rides. Book all three.");
  });
});

describe("calendar export", () => {
  it("converts Chicago wall time to UTC across the DST change", () => {
    expect(
      zonedTimeToUtc("2026-10-19", "18:00", "America/Chicago").toISOString(),
    ).toBe("2026-10-19T23:00:00.000Z");
    expect(
      zonedTimeToUtc("2026-11-02", "18:00", "America/Chicago").toISOString(),
    ).toBe("2026-11-03T00:00:00.000Z");
  });

  it("plans lifts, rides and tests at the settings times, without gated walk-jog", () => {
    const events = programCalendarEvents(
      testProgram(),
      "2026-10-26",
      "2026-11-01",
    );
    expect(events.map((e) => [e.date, e.start, e.minutes])).toEqual([
      ["2026-10-26", "18:00", 60],
      ["2026-10-27", "18:00", 45],
      ["2026-10-29", "18:00", 45],
      ["2026-10-30", "18:00", 60],
    ]);
    const open = programCalendarEvents(
      withGate(testProgram(), "jog", "2026-10-26"),
      "2026-10-27",
      "2026-10-27",
    );
    expect(open).toHaveLength(1);
    expect(open[0]!.description).toContain("15–20 min");
  });

  it("uses edited times from settings", () => {
    const settings = programSettingsFromRows([
      { key: "calendar_lift_time", value: null, textValue: "17:30" },
      { key: "calendar_lift_minutes", value: 60, textValue: null },
      { key: "calendar_peloton_time", value: null, textValue: "nonsense" },
    ]);
    const [monday] = programCalendarEvents(
      testProgram(),
      "2026-10-26",
      "2026-10-26",
      settings,
    );
    expect(monday).toMatchObject({ start: "17:30", minutes: 60 });
    expect(settings.calendarPelotonTime).toBe("18:00");
  });

  it("writes a valid iCalendar file", () => {
    const ics = toIcs(
      [
        {
          uid: "a@x",
          date: "2026-10-26",
          start: "18:00",
          minutes: 80,
          title: "Heavy legs + Push, wk 10",
          description: "Line one\nLine; two",
        },
      ],
      "America/Chicago",
      new Date("2026-10-19T12:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261026T230000Z\r\n");
    expect(ics).toContain("DTEND:20261027T002000Z\r\n");
    expect(ics).toContain("SUMMARY:Heavy legs + Push\\, wk 10");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine\\; two");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
