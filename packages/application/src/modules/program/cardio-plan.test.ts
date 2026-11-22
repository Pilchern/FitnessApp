import { describe, expect, it } from "vitest";
import {
  cardioWeek,
  cardioWeekPlan,
  parseMinutesList,
  rideGoalLines,
  rideGoals,
  rideHoldReason,
  vo2Structure,
  type RideHistoryEntry,
} from "./cardio-plan";
import { DEFAULT_PROGRAM_SETTINGS } from "./program-settings";
import { buildDayPlan } from "./program-plan";
import {
  loadPlannedVo2Intervals,
  plannedVo2IntervalMinutes,
} from "./program-week";
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

describe("planned VO2 intervals for synced rides", () => {
  const program = cardioProgram("2026-11-17");
  const minutesOn = (date: string, readiness: "knee_off" | null = null) =>
    plannedVo2IntervalMinutes(
      buildDayPlan(program, date, readiness, settings),
      settings,
    );

  it("gives the week's work minutes on a VO2 day only", () => {
    expect(minutesOn("2026-11-17")).toBeNull();
    expect(minutesOn("2026-11-19")).toBe(3);
    expect(minutesOn("2026-12-01")).toBe(4);
  });

  it("drops the VO2 day on a knee day off or before the gate clears", () => {
    expect(minutesOn("2026-11-19", "knee_off")).toBeNull();
    const gated = cardioProgram(null);
    expect(
      plannedVo2IntervalMinutes(
        buildDayPlan(gated, "2026-11-19", null, settings),
        settings,
      ),
    ).toBeNull();
  });

  it("loads a date map from the active program and Settings", async () => {
    type Service = Parameters<typeof loadPlannedVo2Intervals>[0];
    const service = {
      getActiveProgram: async () => program,
      listSettings: async () => [
        { key: "cardio_plan_start", value: null, textValue: "2026-11-16" },
      ],
      listKneeChecks: async () => [],
    } as unknown as Service;
    await expect(
      loadPlannedVo2Intervals(service, {
        userId: "u",
        startDate: "2026-11-16",
        endDate: "2026-11-25",
      }),
    ).resolves.toEqual({ "2026-11-19": 3, "2026-11-24": 3 });
    await expect(
      loadPlannedVo2Intervals(
        { ...service, getActiveProgram: async () => null } as Service,
        { userId: "u", startDate: "2026-11-16", endDate: "2026-11-25" },
      ),
    ).resolves.toEqual({});
  });
});

describe("ride goals", () => {
  const ride = (over: Partial<RideHistoryEntry>): RideHistoryEntry => ({
    sessionDate: "2026-11-17",
    sessionKind: "zone2",
    plannedVsCompleted: "completed",
    durationMinutes: 45,
    avgHeartRate: 130,
    avgOutput: 72,
    resistanceMin: null,
    resistanceMax: null,
    intervalOutputs: null,
    ...over,
  });
  const zone2 = { kind: "zone2" as const, minutesMax: 45 };

  it("nudges Zone 2 power off where heart rate sat in the band", () => {
    const low = rideGoals(zone2, [ride({})], settings, "2026-11-24");
    expect(low).toMatchObject({ watts: 77, kj: 208, cadence: "85–90 rpm" });
    expect(
      rideGoals(zone2, [ride({ avgHeartRate: 140 })], settings, "2026-11-24")
        ?.watts,
    ).toBe(72);
    expect(
      rideGoals(zone2, [ride({ avgHeartRate: 148 })], settings, "2026-11-24")
        ?.watts,
    ).toBe(67);
  });

  it("holds the long ride's power the week its minutes go up", () => {
    const goals = rideGoals(
      { kind: "zone2_long", minutesMax: 65 },
      [ride({})],
      settings,
      "2026-11-28",
    );
    expect(goals).toMatchObject({ watts: 72, kj: 281 });
    expect(goals?.basis).toContain("longer");
  });

  it("uses only completed Zone 2 rides of 20+ min before the date", () => {
    const history = [
      ride({}),
      ride({ sessionDate: "2026-11-20", durationMinutes: 15, avgOutput: 90 }),
      ride({ sessionDate: "2026-11-21", plannedVsCompleted: "planned" }),
      ride({ sessionDate: "2026-11-24", avgOutput: 120 }),
    ];
    expect(rideGoals(zone2, history, settings, "2026-11-24")?.watts).toBe(77);
    expect(rideGoals(zone2, [], settings, "2026-11-24")).toBeNull();
  });

  it("sets VO2 power from the last ride's intervals", () => {
    const vo2 = { kind: "vo2_intervals" as const, minutesMax: 36 };
    const last = (outputs: number[]) => [
      ride({ sessionKind: "vo2", intervalOutputs: outputs }),
    ];
    const up = rideGoals(
      vo2,
      last([161, 162, 172, 168]),
      settings,
      "2026-11-24",
    );
    expect(up).toMatchObject({
      watts: 171,
      kj: null,
      cadence: "95–105 rpm, seated",
      heartRate: "165+ bpm by the end of each interval",
    });
    expect(
      rideGoals(vo2, last([161, 162, 172, 168]), settings, "2026-12-01")?.watts,
    ).toBe(166);
    expect(
      rideGoals(vo2, last([180, 170, 165, 162]), settings, "2026-11-24")?.watts,
    ).toBe(169);
  });

  it("reads resistance from the last ride, else asks for it", () => {
    const logged = rideGoals(
      zone2,
      [ride({ resistanceMin: 32, resistanceMax: 35 })],
      settings,
      "2026-11-24",
    );
    expect(logged?.resistance).toBe("32–35 (last ride)");
    const lines = rideGoalLines(
      rideGoals(zone2, [ride({})], settings, "2026-11-24")!,
      "zone2",
    );
    expect(lines[0]).toBe("Output: 77 W avg, about 208 kJ");
    expect(lines[2]).toBe(
      "Resistance: set it to whatever holds 77 W at that cadence; note the number",
    );
    expect(lines).toHaveLength(5);
  });

  describe("holds from the plan", () => {
    const mornings = (latest: number, baseline = 68) => [
      ...Array.from({ length: 10 }, (_, i) => ({
        checkinDate: `2026-11-${String(12 + i).padStart(2, "0")}`,
        restingHeartRate: baseline,
      })),
      { checkinDate: "2026-11-24", restingHeartRate: latest },
    ];

    it("holds Zone 2 power when resting HR is 3+ over its median", () => {
      const held = rideGoals(zone2, [ride({})], settings, "2026-11-24", {
        restingHr: mornings(71),
      });
      expect(held?.watts).toBe(72);
      expect(held?.basis).toContain("resting HR 71 is 3 over");
      expect(
        rideGoals(zone2, [ride({})], settings, "2026-11-24", {
          restingHr: mornings(70),
        })?.watts,
      ).toBe(77);
    });

    it("ignores a stale or thin resting HR record", () => {
      expect(
        rideHoldReason([], "2026-11-27", { restingHr: mornings(80) }),
      ).toBeNull();
      expect(
        rideHoldReason([], "2026-11-24", {
          restingHr: mornings(80).slice(5),
        }),
      ).toBeNull();
    });

    it("holds when the knee check is not normal", () => {
      expect(
        rideGoals(zone2, [ride({})], settings, "2026-11-24", {
          kneeReadiness: "hold",
        })?.watts,
      ).toBe(72);
      expect(
        rideGoals(zone2, [ride({})], settings, "2026-11-24", {
          kneeReadiness: "normal",
        })?.watts,
      ).toBe(77);
    });

    it("holds when Zone 2 HR crept up at the same watts this week", () => {
      const history = [
        ride({ sessionDate: "2026-11-18", avgHeartRate: 128 }),
        ride({ sessionDate: "2026-11-21", avgHeartRate: 133 }),
      ];
      const goals = rideGoals(zone2, history, settings, "2026-11-24");
      expect(goals?.watts).toBe(72);
      expect(goals?.basis).toContain("crept from 128 to 133");
      const moreWatts = [
        history[0]!,
        ride({ sessionDate: "2026-11-21", avgHeartRate: 133, avgOutput: 80 }),
      ];
      expect(rideHoldReason(moreWatts, "2026-11-24")).toBeNull();
    });

    it("never holds a back-off", () => {
      expect(
        rideGoals(
          zone2,
          [ride({ avgHeartRate: 148 })],
          settings,
          "2026-11-24",
          {
            kneeReadiness: "hold",
          },
        )?.watts,
      ).toBe(67);
    });

    it("holds VO2 power too", () => {
      const vo2 = { kind: "vo2_intervals" as const, minutesMax: 36 };
      const history = [
        ride({ sessionKind: "vo2", intervalOutputs: [161, 162, 172, 168] }),
      ];
      expect(
        rideGoals(vo2, history, settings, "2026-11-24", {
          kneeReadiness: "hold",
        })?.watts,
      ).toBe(166);
    });
  });
});
