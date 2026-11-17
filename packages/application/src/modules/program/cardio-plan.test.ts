import { describe, expect, it } from "vitest";
import {
  cardioWeek,
  cardioWeekPlan,
  parseMinutesList,
  vo2Structure,
} from "./cardio-plan";
import { DEFAULT_PROGRAM_SETTINGS } from "./program-settings";
import { buildDayPlan } from "./program-plan";
import { block, gate, session } from "./program-fixtures.test-helpers";
import type { TrainingProgram } from "@fitness-app/domain";

const settings = {
  ...DEFAULT_PROGRAM_SETTINGS,
  cardioPlanStart: "2026-11-16",
};

describe("cardio plan progression", () => {
  it("numbers weeks from the plan start, Monday to Sunday", () => {
    expect(cardioWeek(settings, "2026-11-15")).toBeNull();
    expect(cardioWeek(settings, "2026-11-16")).toBe(1);
    expect(cardioWeek(settings, "2026-11-22")).toBe(1);
    expect(cardioWeek(settings, "2026-11-23")).toBe(2);
    expect(cardioWeek({ cardioPlanStart: "" }, "2026-11-23")).toBeNull();
  });

  it("follows the 6-week table, then holds at 4 x 4 and 90 min", () => {
    const rows = [
      ["2026-11-19", 3, 60],
      ["2026-11-24", 3, 65],
      ["2026-12-01", 4, 70],
      ["2026-12-08", 4, 75],
      ["2026-12-15", 4, 80],
      ["2026-12-22", 4, 90],
      ["2027-02-02", 4, 90],
    ] as const;
    for (const [date, interval, long] of rows) {
      const plan = cardioWeekPlan(settings, date);
      expect(plan?.intervalMinutes).toBe(interval);
      expect(plan?.longRideMinutes).toBe(long);
    }
  });

  it("times a VO2 ride as warm-up, 4 work, 3 equal recoveries, cool-down", () => {
    expect(cardioWeekPlan(settings, "2026-11-19")?.vo2RideMinutes).toBe(36);
    expect(cardioWeekPlan(settings, "2026-12-01")?.vo2RideMinutes).toBe(43);
    expect(vo2Structure(3)).toContain("4 x 3 min hard, 3 min easy between");
  });

  it("turns the sprint finisher on only when cleared, from week 5", () => {
    expect(cardioWeekPlan(settings, "2026-12-17")?.sprintFinisher).toBe(false);
    const cleared = { ...settings, sprintFinisherCleared: 1 };
    expect(cardioWeekPlan(cleared, "2026-12-10")?.sprintFinisher).toBe(false);
    expect(cardioWeekPlan(cleared, "2026-12-17")?.sprintFinisher).toBe(true);
  });

  it("parses minute lists leniently", () => {
    expect(parseMinutesList("3, 3,4  4")).toEqual([3, 3, 4, 4]);
    expect(parseMinutesList("")).toEqual([]);
  });
});

/** Live layout from 2026-11-16: week 13 swaps Tue/Thu, then Tue VO2. */
function cardioProgram(intervalsCleared: string | null): TrainingProgram {
  const rides = (blockId: string, tue: "zone2" | "vo2", thu: "zone2" | "vo2") =>
    [
      [2, tue],
      [4, thu],
    ]
      .map(([day, kind]) =>
        session({
          id: `${blockId}-${day}`,
          blockId,
          dayOfWeek: day as number,
          sessionType: "peloton",
          rideKind: kind === "vo2" ? "vo2_intervals" : "zone2",
          gateKey: kind === "vo2" ? "intervals" : null,
          minutesMin: 45,
          minutesMax: 45,
        }),
      )
      .concat(
        session({
          id: `${blockId}-sat`,
          blockId,
          dayOfWeek: 6,
          sessionType: "peloton",
          rideKind: "zone2_long",
          minutesMin: 60,
          minutesMax: 60,
        }),
      );
  return {
    id: "p",
    userId: "u",
    name: "ACL return",
    version: null,
    weekAnchorDate: "2026-08-17",
    returnToSportWeek: 39,
    testDayUrl: null,
    notes: null,
    blocks: [
      block("w13", "Deload + Test", 13, 13),
      block("b2", "Block 2 Strength", 14, 17),
    ],
    weeks: [],
    sessions: [...rides("w13", "zone2", "vo2"), ...rides("b2", "vo2", "zone2")],
    gates: [gate("intervals", intervalsCleared)],
  };
}

function ride(program: TrainingProgram, date: string, s = settings) {
  const planned = buildDayPlan(program, date, null, s).sessions.find(
    (p) => p.ride,
  );
  return planned?.ride ?? null;
}

describe("cardio plan in the day plan", () => {
  const program = cardioProgram("2026-11-17");

  it("renders the week of Nov 16 with the exception", () => {
    expect(ride(program, "2026-11-17")).toMatchObject({
      kind: "zone2",
      minutesMax: 45,
      target: "HR 130-145 bpm, hard cap 145.",
    });
    expect(ride(program, "2026-11-19")).toMatchObject({
      kind: "vo2_intervals",
      minutesMax: 36,
      target: "HR 165+ by the end of each interval.",
    });
    expect(ride(program, "2026-11-19")?.structure).toContain("4 x 3 min");
    expect(ride(program, "2026-11-21")).toMatchObject({
      kind: "zone2_long",
      minutesMax: 60,
    });
  });

  it("runs Tue VO2, Thu Zone 2 45, Sat long from Nov 23", () => {
    expect(ride(program, "2026-11-24")?.structure).toContain("4 x 3 min");
    expect(ride(program, "2026-11-26")).toMatchObject({
      kind: "zone2",
      minutesMax: 45,
      finisher: null,
    });
    expect(ride(program, "2026-11-28")?.minutesMax).toBe(65);
    expect(ride(program, "2026-12-01")?.structure).toContain("4 x 4 min");
    expect(ride(program, "2026-12-19")?.minutesMax).toBe(80);
  });

  it("adds the sprint finisher to Thursday from week 5 once cleared", () => {
    const cleared = { ...settings, sprintFinisherCleared: 1 };
    expect(ride(program, "2026-12-10", cleared)?.finisher).toBeNull();
    expect(ride(program, "2026-12-17", cleared)?.finisher).toContain("all-out");
    expect(ride(program, "2026-12-17")?.finisher).toBeNull();
  });

  it("keeps the minutes when a knee day off turns intervals into Zone 2", () => {
    const planned = buildDayPlan(program, "2026-12-01", "knee_off", settings)
      .sessions[0].ride;
    expect(planned).toMatchObject({ kind: "zone2", minutesMax: 43 });
  });

  it("rides Zone 2 while the intervals gate is closed", () => {
    expect(ride(cardioProgram(null), "2026-11-19")?.kind).toBe("zone2");
  });
});
