import { describe, expect, it } from "vitest";
import type { StrengthSession } from "@fitness-app/domain";
import {
  blockForWeek,
  isGateCleared,
  postOpWeek,
  programMilestones,
  programWeekInfo,
  weekDateRange,
} from "./program-calendar";
import { kneeOffStreak, kneeReadinessStatus } from "./knee-readiness";
import {
  DEFAULT_PROGRAM_SETTINGS,
  programSettingsFromRows,
  settingRowKey,
} from "./program-settings";
import {
  effectiveScheme,
  estimatedMax,
  exerciseProgress,
  hitTopOfRange,
  legExerciseIndex,
  newBlockStartLoad,
  repRangeSteps,
  nextLoad,
  plannedSetCount,
  roundDownToLoadStep,
  sleepAverageHours,
  suggestLoad,
  weeklyHardLegSets,
  type SuggestLoadInput,
} from "./program-progression";
import {
  buildDayPlan,
  inWeekWindow,
  planExercise,
  prescribedRepsMaxOn,
  programWeekDates,
  rightLegRepsTarget,
  sessionsForBlock,
  type PlanContext,
} from "./program-plan";
import {
  block,
  exercise,
  gate,
  testProgram,
  withGate,
} from "./program-fixtures.test-helpers";
import { buildLiftLoggerPlan, lastSetsByExercise } from "./program-logger-plan";

const ANCHOR = "2026-08-17";

describe("post-op week and block from the surgery date", () => {
  it("counts whole weeks from the surgery date", () => {
    expect(postOpWeek(ANCHOR, "2026-08-17")).toBe(0);
    expect(postOpWeek(ANCHOR, "2026-08-23")).toBe(0);
    expect(postOpWeek(ANCHOR, "2026-08-24")).toBe(1);
    expect(postOpWeek(ANCHOR, "2026-10-19")).toBe(9);
    expect(postOpWeek(ANCHOR, "2026-10-25")).toBe(9);
    expect(postOpWeek(ANCHOR, "2026-10-26")).toBe(10);
  });

  it("is not thrown off by the DST change (Nov 1)", () => {
    expect(postOpWeek(ANCHOR, "2026-11-01")).toBe(10);
    expect(postOpWeek(ANCHOR, "2026-11-02")).toBe(11);
  });

  it("gives each week a Monday-to-Sunday range", () => {
    expect(weekDateRange(ANCHOR, 9)).toEqual({
      start: "2026-10-19",
      end: "2026-10-25",
    });
    expect(programWeekDates(testProgram(), "2026-10-22")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("finds the block holding a week, null outside every block", () => {
    const { blocks } = testProgram();
    expect(blockForWeek(blocks, 9)?.name).toBe("On-ramp");
    expect(blockForWeek(blocks, 12)?.name).toBe("Block 1 Build");
    expect(blockForWeek(blocks, 13)?.name).toBe("Deload/Test");
    expect(blockForWeek(blocks, 38)?.name).toBe("Block 4 Sport Prep");
    expect(blockForWeek(blocks, 8)).toBeNull();
    expect(blockForWeek(blocks, 39)).toBeNull();
  });

  it("reports deload weeks and the week index inside a block", () => {
    const p = testProgram();
    expect(programWeekInfo(p, "2026-11-16")).toMatchObject({
      week: 13,
      isDeload: true,
      weekIndexInBlock: 0,
    });
    expect(programWeekInfo(p, "2026-11-09")).toMatchObject({
      week: 12,
      isDeload: false,
      weekIndexInBlock: 2,
      dayOfWeek: 1,
    });
  });

  it("puts the milestones on the planned dates", () => {
    const dates = Object.fromEntries(
      programMilestones(testProgram()).map((m) => [m.label, m.date]),
    );
    expect(dates).toMatchObject({
      "Block 1 Build": "2026-10-26",
      "Deload/Test": "2026-11-16",
      "Block 2 Strength": "2026-11-23",
      "Block 3 Heavy + Power": "2026-12-28",
      "Block 4 Sport Prep": "2027-01-25",
      "Return to sport (earliest)": "2027-05-17",
    });
  });
});

describe("knee readiness", () => {
  const check = (
    swelling: "none" | "trace" | "1+" | "2+",
    graftPain: number,
    extensionFull: boolean,
  ) => kneeReadinessStatus({ swelling, graftPain, extensionFull });

  it("is normal with 0 or trace swelling, pain 2 or less and full extension", () => {
    expect(check("none", 0, true)).toBe("normal");
    expect(check("trace", 2, true)).toBe("normal");
  });

  it("holds loads on trace swelling with pain 3", () => {
    expect(check("trace", 3, true)).toBe("hold");
    expect(check("none", 3, true)).toBe("hold");
  });

  it("is a knee day off on 1+ swelling, pain above 3 or extension not full", () => {
    expect(check("1+", 0, true)).toBe("knee_off");
    expect(check("2+", 0, true)).toBe("knee_off");
    expect(check("none", 4, true)).toBe("knee_off");
    expect(check("trace", 1, false)).toBe("knee_off");
  });

  it("waits for all three answers", () => {
    expect(kneeReadinessStatus(null)).toBeNull();
    expect(
      kneeReadinessStatus({
        swelling: "none",
        graftPain: null,
        extensionFull: true,
      }),
    ).toBeNull();
  });
});

describe("load steps", () => {
  it("adds 5 lb barbell, 2.5 lb cuff, the next dumbbell size", () => {
    expect(nextLoad(95, "barbell")).toBe(100);
    expect(nextLoad(10, "cuff")).toBe(12.5);
    expect(nextLoad(20, "dumbbell")).toBe(22.5);
    expect(nextLoad(25, "dumbbell")).toBe(30);
    expect(nextLoad(0, "bodyweight")).toBeNull();
  });

  it("rounds down to a load the equipment can make", () => {
    expect(roundDownToLoadStep(110.5, "barbell")).toBe(110);
    expect(roundDownToLoadStep(13.9, "cuff")).toBe(12.5);
    expect(roundDownToLoadStep(23.4, "dumbbell")).toBe(22.5);
    expect(roundDownToLoadStep(33, "dumbbell")).toBe(30);
  });
});

describe("prescription and deload rules", () => {
  const b1 = block("b1", "Block 1", 10, 12, {
    setsMin: 3,
    setsMax: 4,
    repsMin: 10,
    repsMax: 12,
    rirTarget: 2,
  });

  it("takes the exercise's own numbers, else the block's, else the source block's", () => {
    const own = exercise({
      name: "x",
      setsMin: 5,
      setsMax: 5,
      repsMin: 5,
      repsMax: 5,
    });
    expect(effectiveScheme(own, b1)).toMatchObject({
      setsMin: 5,
      repsMax: 5,
      rirTarget: 2,
    });
    const deload = block("d", "Deload", 13, 13);
    expect(effectiveScheme(exercise({ name: "y" }), deload, b1)).toEqual({
      setsMin: 3,
      setsMax: 4,
      repsMin: 10,
      repsMax: 12,
      rirTarget: 2,
    });
  });

  it("starts a block at the low set count, then the high one", () => {
    expect(plannedSetCount({ setsMin: 3, setsMax: 4 }, 0, false)).toBe(3);
    expect(plannedSetCount({ setsMin: 3, setsMax: 4 }, 1, false)).toBe(4);
  });

  it("takes one set off on a deload week, never below one", () => {
    expect(plannedSetCount({ setsMin: 3, setsMax: 4 }, 0, true)).toBe(3);
    expect(plannedSetCount({ setsMin: 1, setsMax: 1 }, 0, true)).toBe(1);
  });

  it("runs Block 1's sessions in the deload week with one set fewer", () => {
    const p = testProgram();
    const deload = p.blocks.find((b) => b.id === "deload1")!;
    expect(sessionsForBlock(p, deload).every((s) => s.blockId === "b1")).toBe(
      true,
    );
    const monday = buildDayPlan(
      withGate(p, "barbell_squat", "2026-10-01"),
      "2026-11-16",
      "normal",
    );
    const squat = monday.sessions[0]!.exercises[0]!;
    expect(squat.sets).toBe(3);
    expect(squat.scheme.repsMax).toBe(12);
  });
});

describe("progression engine", () => {
  const scheme = {
    setsMin: 3,
    setsMax: 4,
    repsMin: 10,
    repsMax: 12,
    rirTarget: 2,
  };
  const sets = (weight: number, reps: number[], rir = 2) =>
    reps.map((r) => ({ weight, reps: r, rir }));
  const base: SuggestLoadInput = {
    loadKind: "barbell",
    scheme,
    lastSets: sets(95, [12, 12, 12]),
    lastRepsMax: 12,
    readiness: "normal",
    isDeload: false,
  };

  it("adds load when every set hit the top of the range at RIR 2+", () => {
    expect(suggestLoad(base)).toMatchObject({ load: 100, kind: "increase" });
    expect(
      suggestLoad({
        ...base,
        loadKind: "cuff",
        lastSets: sets(10, [12, 12, 12]),
      }),
    ).toMatchObject({ load: 12.5, kind: "increase" });
    expect(
      suggestLoad({
        ...base,
        loadKind: "dumbbell",
        lastSets: sets(30, [12, 12, 12]),
      }),
    ).toMatchObject({ load: 35, kind: "increase" });
  });

  it("keeps the load when a set missed the top or ran under RIR 2", () => {
    expect(
      suggestLoad({ ...base, lastSets: sets(95, [12, 12, 11]) }),
    ).toMatchObject({
      load: 95,
      kind: "same",
      held: false,
    });
    expect(
      suggestLoad({ ...base, lastSets: sets(95, [12, 12, 12], 1) }),
    ).toMatchObject({
      load: 95,
      kind: "same",
    });
    expect(hitTopOfRange([{ weight: 95, reps: 12, rir: null }], 12)).toBe(
      false,
    );
  });

  it("never increases unless the knee check was normal", () => {
    for (const readiness of ["hold", "knee_off", null] as const) {
      expect(suggestLoad({ ...base, readiness })).toMatchObject({
        load: 95,
        kind: "same",
        held: true,
      });
    }
  });

  it("never increases in a deload week", () => {
    expect(suggestLoad({ ...base, isDeload: true })).toMatchObject({
      load: 95,
      kind: "same",
      held: true,
    });
  });

  it("progresses per-leg lifts off the left leg only", () => {
    const perLeg = [
      { weight: 10, reps: 12, rir: 2, side: "left" as const },
      { weight: 10, reps: 10, rir: 2, side: "right" as const },
      { weight: 10, reps: 12, rir: 2, side: "left" as const },
      { weight: 10, reps: 9, rir: 2, side: "right" as const },
    ];
    expect(
      suggestLoad({ ...base, loadKind: "cuff", lastSets: perLeg }),
    ).toMatchObject({
      load: 12.5,
      kind: "increase",
    });
    const leftMissed = perLeg.map((s) =>
      s.side === "left" ? { ...s, reps: 11 } : { ...s, reps: 12 },
    );
    expect(
      suggestLoad({ ...base, loadKind: "cuff", lastSets: leftMissed }),
    ).toMatchObject({
      load: 10,
      kind: "same",
    });
  });

  it("ignores warm-ups", () => {
    const withWarmup = [
      { weight: 45, reps: 5, rir: 5, isWarmup: true },
      ...sets(95, [12, 12, 12]),
    ];
    expect(suggestLoad({ ...base, lastSets: withWarmup })).toMatchObject({
      load: 100,
    });
  });

  it("suggests a new-block start: top load x 1.1 per step down in reps", () => {
    expect(estimatedMax(100, 10, 2)).toBeCloseTo(140);
    expect(newBlockStartLoad(sets(100, [10, 10, 10]), 1, "barbell")).toBe(110);
    // Two steps (12 -> 5 skipping 8): 100 x 1.21 = 121, down to 120.
    expect(newBlockStartLoad(sets(100, [10, 10, 10]), 2, "barbell")).toBe(120);
    // A step up in reps divides: 110 / 1.1 = 100.
    expect(newBlockStartLoad(sets(110, [5, 5]), -1, "barbell")).toBe(100);
    // Dumbbells round down to the next DB: 40 x 1.1 = 44 -> 40.
    expect(newBlockStartLoad(sets(40, [12, 12]), 1, "dumbbell")).toBe(40);
    expect(newBlockStartLoad(sets(50, [12, 12]), 1, "dumbbell")).toBe(55);
    // Per-leg: the left leg's load only.
    expect(
      newBlockStartLoad(
        [
          { weight: 20, reps: 12, rir: 2, side: "left" },
          { weight: 30, reps: 12, rir: 2, side: "right" },
        ],
        1,
        "dumbbell",
      ),
    ).toBe(20);
    expect(
      suggestLoad({
        ...base,
        scheme: {
          setsMin: 4,
          setsMax: 4,
          repsMin: 6,
          repsMax: 8,
          rirTarget: 2,
        },
        lastSets: sets(100, [10, 10, 10]),
        lastRepsMax: 12,
      }),
    ).toMatchObject({ load: 110, kind: "new_block" });
  });

  it("counts rep-range steps on the program's ladder", () => {
    const ladder = [12, 12, 8, 5, 3];
    expect(repRangeSteps(12, 12, ladder)).toBe(0);
    expect(repRangeSteps(12, 8, ladder)).toBe(1);
    expect(repRangeSteps(8, 5, ladder)).toBe(1);
    expect(repRangeSteps(12, 5, ladder)).toBe(2);
    // Block 3 (3-5) to Strength A (4-6): one step up.
    expect(repRangeSteps(5, 6, [...ladder, 6])).toBe(-1);
    // An accessory's own range off the ladder still moves one step.
    expect(repRangeSteps(15, 12, ladder)).toBe(1);
    expect(repRangeSteps(12, 10, [])).toBe(1);
  });

  it("does not jump to a new-block load on a hold day", () => {
    expect(
      suggestLoad({
        ...base,
        scheme: {
          setsMin: 4,
          setsMax: 4,
          repsMin: 6,
          repsMax: 8,
          rirTarget: 2,
        },
        lastSets: sets(100, [10, 10, 10]),
        lastRepsMax: 12,
        readiness: "hold",
      }),
    ).toMatchObject({ load: 100, kind: "same" });
  });

  it("asks for a starting load with no history", () => {
    expect(suggestLoad({ ...base, lastSets: [] })).toMatchObject({
      load: null,
      kind: "start",
    });
  });

  it("does not add load to bodyweight work", () => {
    expect(
      suggestLoad({
        ...base,
        loadKind: "bodyweight",
        lastSets: sets(0, [12, 12, 12]),
      }),
    ).toMatchObject({ load: null, kind: "same" });
  });
});

describe("left-leg sets the right leg's reps", () => {
  it("uses the left leg's logged reps", () => {
    expect(rightLegRepsTarget("9", 12)).toBe(9);
    expect(rightLegRepsTarget(11, 12)).toBe(11);
  });

  it("falls back to the prescription until the left set is logged", () => {
    expect(rightLegRepsTarget("", 12)).toBe(12);
    expect(rightLegRepsTarget(null, 12)).toBe(12);
    expect(rightLegRepsTarget("abc", 12)).toBe(12);
    expect(rightLegRepsTarget("0", 12)).toBe(12);
  });
});

describe("gates", () => {
  const ctx: PlanContext = {
    week: 10,
    gates: [gate("barbell_squat"), gate("plyo", "2026-11-09")],
    date: "2026-10-26",
    readiness: "normal",
    block: block("b1", "Block 1", 10, 12, {
      setsMin: 3,
      setsMax: 4,
      repsMin: 10,
      repsMax: 12,
    }),
    sourceBlock: null,
    weekIndexInBlock: 0,
    isDeload: false,
  };

  it("counts a gate cleared from its date on; unknown gates stay closed", () => {
    expect(isGateCleared(ctx.gates, null, "2026-10-26")).toBe(true);
    expect(isGateCleared(ctx.gates, "plyo", "2026-11-08")).toBe(false);
    expect(isGateCleared(ctx.gates, "plyo", "2026-11-09")).toBe(true);
    expect(isGateCleared(ctx.gates, "nope", "2030-01-01")).toBe(false);
  });

  it("shows the substitute while a gate with one is closed", () => {
    const squat = exercise({
      name: "Barbell Pin Squat",
      gateKey: "barbell_squat",
      substituteName: "Goblet Box Squat",
      substituteLoadKind: "dumbbell",
    });
    expect(planExercise(squat, ctx)).toMatchObject({
      status: "substitute",
      name: "Goblet Box Squat",
      loadKind: "dumbbell",
    });
    const cleared = { ...ctx, gates: [gate("barbell_squat", "2026-10-20")] };
    expect(planExercise(squat, cleared)).toMatchObject({
      status: "active",
      name: "Barbell Pin Squat",
      loadKind: "barbell",
    });
  });

  it("greys out a gated exercise with no substitute", () => {
    const pogo = exercise({ name: "Pogo", gateKey: "plyo" });
    expect(planExercise(pogo, ctx)).toMatchObject({
      status: "locked",
      lockedReason: "Waiting on gate: plyo",
    });
  });

  it("hides normal-only work on a hold, knee-off or unchecked day", () => {
    const snap = exercise({
      name: "Snap-Down",
      readinessRequirement: "normal",
    });
    expect(planExercise(snap, ctx).status).toBe("active");
    for (const readiness of ["hold", "knee_off", null] as const) {
      expect(planExercise(snap, { ...ctx, readiness }).status).toBe(
        "readiness_hidden",
      );
    }
  });
});

describe("day plan", () => {
  it("has no landing prep in the On-ramp and gates all landing prep from week 10", () => {
    const p = testProgram();
    const onramp = buildDayPlan(p, "2026-10-23", "normal");
    expect(onramp.info.block?.name).toBe("On-ramp");
    const statuses = (program: typeof p) =>
      Object.fromEntries(
        buildDayPlan(
          program,
          "2026-10-30",
          "normal",
        ).sessions[0]!.exercises.map((e) => [e.name, e.status]),
      );
    expect(statuses(p)).toMatchObject({
      "Snap-Down to Stick": "locked",
      "Double-Leg Pogo": "locked",
    });
    expect(statuses(withGate(p, "plyo", "2026-10-30"))).toMatchObject({
      "Snap-Down to Stick": "active",
      "Double-Leg Pogo": "active",
    });
  });

  it("runs a gated interval ride as seated Zone 2, same length, until cleared", () => {
    const closed = buildDayPlan(testProgram(), "2026-10-29", "normal")
      .sessions[0]!;
    expect(closed).toMatchObject({
      name: "Peloton Zone 2",
      visible: true,
      hiddenReason: null,
    });
    expect(closed.ride).toMatchObject({
      kind: "zone2",
      minutesMin: 45,
      minutesMax: 45,
      structure: null,
    });
    expect(closed.ride?.note).toContain('"intervals" is cleared');

    const open = buildDayPlan(
      withGate(testProgram(), "intervals", "2026-10-29"),
      "2026-10-29",
      "normal",
    ).sessions[0]!;
    expect(open.name).toBe(open.session.name);
    expect(open.ride).toMatchObject({
      kind: "climb_intervals",
      minutesMax: 45,
      structure: "5 x 3 min seated",
      note: null,
    });
  });

  it("still hides gated sessions that are not rides", () => {
    const walkJog = buildDayPlan(testProgram(), "2026-10-27", "normal")
      .sessions[0]!;
    expect(walkJog.session.sessionType).toBe("walk_jog");
    expect(walkJog.visible).toBe(false);
  });

  it("swaps the leg block on a knee day off and turns climbs into Zone 2", () => {
    const p = withGate(testProgram(), "intervals", "2026-10-26");
    expect(
      buildDayPlan(p, "2026-10-26", "knee_off").sessions[0]!.legBlockReplaced,
    ).toBe(true);
    expect(
      buildDayPlan(p, "2026-10-26", "normal").sessions[0]!.legBlockReplaced,
    ).toBe(false);
    const thursday = buildDayPlan(p, "2026-10-29", "knee_off").sessions[0]!;
    expect(thursday.ride).toMatchObject({ kind: "zone2", structure: null });
    expect(
      buildDayPlan(p, "2026-10-29", "normal").sessions[0]!.ride?.kind,
    ).toBe("climb_intervals");
    expect(
      buildDayPlan(p, "2026-10-22", "normal").sessions[0]!.ride?.kind,
    ).toBe("zone2");
  });

  it("schedules walk-jog only once jog is cleared, and shortens the ride", () => {
    const closed = buildDayPlan(testProgram(), "2026-10-27", "normal");
    const walkJog = closed.sessions.find(
      (s) => s.session.sessionType === "walk_jog",
    )!;
    expect(walkJog.visible).toBe(false);
    expect(closed.sessions.find((s) => s.ride)!.ride).toMatchObject({
      minutesMin: 30,
      minutesMax: 45,
    });

    const open = buildDayPlan(
      withGate(testProgram(), "jog", "2026-10-26"),
      "2026-10-27",
      "normal",
    );
    expect(open.sessions.map((s) => s.session.sessionType)).toEqual([
      "walk_jog",
      "peloton",
    ]);
    expect(open.sessions[0]!.visible).toBe(true);
    expect(open.sessions[1]!.ride).toMatchObject({
      minutesMin: 15,
      minutesMax: 20,
    });
  });

  it("keeps walk-jog off unless the knee check is normal", () => {
    const p = withGate(testProgram(), "jog", "2026-10-26");
    for (const readiness of ["hold", "knee_off"] as const) {
      const plan = buildDayPlan(p, "2026-10-27", readiness);
      expect(plan.sessions[0]!.visible).toBe(false);
      expect(plan.sessions[1]!.ride?.minutesMax).toBe(45);
    }
  });

  it("never schedules walk-jog on a lift day", () => {
    const p = withGate(testProgram(), "jog", "2026-10-26");
    p.sessions.push({
      ...p.sessions.find((s) => s.sessionType === "walk_jog")!,
      id: "bad",
      dayOfWeek: 3,
    });
    const wednesday = buildDayPlan(p, "2026-10-28", "normal");
    expect(
      wednesday.sessions.find((s) => s.session.id === "bad")?.visible,
    ).toBe(false);
  });

  it("is empty outside every block", () => {
    expect(
      buildDayPlan(testProgram(), "2027-06-01", "normal").sessions,
    ).toEqual([]);
  });
});

describe("weekly hard leg sets and progress", () => {
  const index = legExerciseIndex([
    {
      name: "Barbell Pin Squat",
      primaryMuscle: "quads",
      measure: "reps",
      substituteName: "Goblet Box Squat",
    },
    {
      name: "Cuff Knee Extension",
      primaryMuscle: "quads",
      measure: "reps",
      substituteName: null,
    },
    {
      name: "Single-Leg Calf Raise",
      primaryMuscle: "calves",
      measure: "reps",
      substituteName: null,
    },
    {
      name: "Spanish Squat",
      primaryMuscle: "quads",
      measure: "time",
      substituteName: null,
    },
  ]);
  const set = (
    exerciseName: string,
    extra: Partial<StrengthSession["sets"][number]> = {},
  ) =>
    ({
      id: "x",
      userId: "u",
      strengthSessionId: "s",
      exerciseName,
      exerciseOrder: 0,
      setNumber: 1,
      reps: 10,
      weight: 50,
      rir: 2,
      isWarmup: false,
      durationSeconds: null,
      distanceMeters: null,
      notes: null,
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
      ...extra,
    }) as StrengthSession["sets"][number];

  const sessions = [
    {
      sessionDate: "2026-10-19",
      sets: [
        set("Goblet Box Squat"),
        set("Goblet Box Squat"),
        set("goblet box squat", { isWarmup: true }),
        set("Cuff Knee Extension", { side: "left", weight: 10 }),
        set("Cuff Knee Extension", { side: "right", weight: 10 }),
        set("Single-Leg Calf Raise", { rir: 5 }),
        set("Spanish Squat", { reps: null, durationSeconds: 45 }),
        set("Barbell Bench Press"),
      ],
    },
    { sessionDate: "2026-10-26", sets: [set("Goblet Box Squat")] },
  ];

  it("counts working rep sets of program leg exercises at RIR 4 or less", () => {
    const count = weeklyHardLegSets(sessions, index, {
      start: "2026-10-19",
      end: "2026-10-25",
    });
    // 2 goblet + 1 left knee extension; warm-up, right leg, RIR 5, timed and
    // upper-body sets do not count; the next week is outside the range.
    // No exercise here is flagged counts_as_quad_set.
    expect(count).toEqual({ total: 3, byMuscle: { quads: 3 }, quadSets: 0 });
  });

  it("tracks left vs right loads per session", () => {
    const points = exerciseProgress(sessions, "Cuff Knee Extension");
    expect(points).toEqual([
      {
        date: "2026-10-19",
        load: null,
        leftLoad: 10,
        rightLoad: 10,
        leftPeakNewtons: null,
        rightPeakNewtons: null,
      },
    ]);
    expect(
      exerciseProgress(sessions, "Goblet Box Squat").map((p) => p.load),
    ).toEqual([50, 50]);
  });
});

describe("rep range on a past date", () => {
  it("reads the scheme in force on that date, by name or substitute name", () => {
    const p = testProgram();
    // Block 1 (10-12) on 2026-10-26; Block 2 (6-8) on 2026-11-23.
    expect(prescribedRepsMaxOn(p, "Goblet Box Squat", "2026-10-26")).toBe(12);
    expect(prescribedRepsMaxOn(p, "barbell pin squat", "2026-11-23")).toBe(8);
    expect(prescribedRepsMaxOn(p, "Bench Press", "2026-11-23")).toBeNull();
    expect(prescribedRepsMaxOn(p, "Goblet Box Squat", "2026-01-01")).toBeNull();
  });
});

describe("lift plan for the logger", () => {
  const program = withGate(testProgram(), "barbell_squat", null);
  const history = lastSetsByExercise([
    {
      sessionDate: "2026-10-19",
      sets: [
        {
          exerciseName: "Goblet Box Squat",
          reps: 12,
          weight: 35,
          rir: 3,
          isWarmup: false,
        },
        {
          exerciseName: "Goblet Box Squat",
          reps: 12,
          weight: 35,
          rir: 3,
          isWarmup: false,
        },
        {
          exerciseName: "Cuff Knee Extension",
          reps: 12,
          weight: 5,
          rir: 3,
          isWarmup: false,
          side: "left",
        },
        {
          exerciseName: "Cuff Knee Extension",
          reps: 10,
          weight: 5,
          rir: 3,
          isWarmup: false,
          side: "right",
        },
      ] as never,
    },
  ]);
  const upper = {
    notes: "Upper rules",
    exercises: [
      {
        exerciseName: "Barbell Bench Press",
        exerciseOrder: 1,
        targetSets: 3,
        targetReps: 8,
        targetWeight: 165,
        targetRir: 2,
        notes: null,
      },
    ],
  };

  function plan(date: string, readiness: "normal" | "hold" | "knee_off") {
    const day = buildDayPlan(program, date, readiness);
    return buildLiftLoggerPlan({
      program,
      planned: day.sessions[0]!,
      info: day.info,
      readiness,
      history,
      upper,
    });
  }

  it("puts legs first with engine loads, then the upper template", () => {
    const p = plan("2026-10-26", "normal");
    expect(p.name).toBe("b1-mon · Wk 10");
    expect(p.exercises.map((e) => e.exerciseName)).toEqual([
      "Goblet Box Squat",
      "Cuff Knee Extension",
      "Barbell Bench Press",
    ]);
    // Week 9 was 12 reps (On-ramp top); Block 1 tops out at 12 too, so this
    // is double progression, not a new block: every set hit 12 at RIR 3.
    expect(p.exercises[0]).toMatchObject({
      targetSets: 3,
      targetReps: 12,
      targetWeight: 40,
      program: true,
    });
    expect(p.exercises[1]).toMatchObject({
      sideMode: "per_leg",
      targetWeight: 7.5,
    });
    expect(p.exercises[2]).toMatchObject({
      targetWeight: 165,
      exerciseOrder: 2,
    });
    expect(p.notes).toContain("Post-op week 10 · Block 1 Build.");
  });

  it("repeats loads on a hold day", () => {
    const p = plan("2026-10-26", "hold");
    expect(p.exercises[0]).toMatchObject({ targetWeight: 35 });
    expect(p.notes).toContain("Repeat loads");
  });

  it("swaps the leg block for ROM + walk on a knee day off, upper still runs", () => {
    const p = plan("2026-10-26", "knee_off");
    expect(p.exercises.map((e) => e.exerciseName)).toEqual([
      "Knee day off: ROM + easy walk",
      "Barbell Bench Press",
    ]);
    expect(p.exercises[0]).toMatchObject({
      measure: "time",
      targetSeconds: 900,
    });
  });

  it("logs force and time work without loads", () => {
    const friday = buildDayPlan(program, "2026-10-30", "normal");
    const p = buildLiftLoggerPlan({
      program,
      planned: friday.sessions[0]!,
      info: friday.info,
      readiness: "normal",
      history: {},
      upper: null,
    });
    const iso = p.exercises.find((e) => e.measure === "force")!;
    expect(iso).toMatchObject({
      targetSets: 5,
      targetSeconds: 5,
      targetWeight: null,
    });
    expect(p.exercises.map((e) => e.exerciseName)).not.toContain(
      "Double-Leg Pogo",
    );
  });
});

describe("Phase A: settings", () => {
  it("overlays seeded rows on the defaults; blank values keep the default", () => {
    const s = programSettingsFromRows([
      { key: "barbell_step_lb", value: 10, textValue: null },
      { key: "quad_sets_min", value: null, textValue: null },
      { key: "ortho_phone", value: null, textValue: " 555-0100 " },
      { key: "ortho_name", value: null, textValue: "" },
    ]);
    expect(s.barbellStepLb).toBe(10);
    expect(s.quadSetsMin).toBe(12);
    expect(s.orthoPhone).toBe("555-0100");
    expect(s.orthoName).toBe("OrthoIllinois");
    expect(settingRowKey("sleepMinHoursForIncrease")).toBe(
      "sleep_min_hours_for_increase",
    );
  });

  it("feeds load steps from settings", () => {
    const s = { ...DEFAULT_PROGRAM_SETTINGS, barbellStepLb: 10, cuffStepLb: 1 };
    expect(nextLoad(95, "barbell", s)).toBe(105);
    expect(nextLoad(5, "cuff", s)).toBe(6);
  });

  it("moves the knee-check cut-offs with the settings", () => {
    const check = {
      swelling: "none" as const,
      graftPain: 3,
      extensionFull: true,
    };
    expect(kneeReadinessStatus(check)).toBe("hold");
    expect(
      kneeReadinessStatus(check, {
        readinessNormalMaxPain: 3,
        readinessKneeOffAbovePain: 4,
      }),
    ).toBe("normal");
  });
});

describe("Phase A: sleep and the progression engine", () => {
  const rows = [
    { checkinDate: "2026-10-26", sleepDurationMinutes: 360 },
    { checkinDate: "2026-10-25", sleepDurationMinutes: 390 },
    { checkinDate: "2026-10-24", sleepDurationMinutes: 420 },
    { checkinDate: "2026-10-23", sleepDurationMinutes: 600 },
    { checkinDate: "2026-10-22", sleepDurationMinutes: null },
  ];

  it("averages the last 3 nights (dated by wake day)", () => {
    expect(sleepAverageHours(rows, "2026-10-26", 3)).toBeCloseTo(6.5);
    expect(sleepAverageHours(rows, "2026-10-23", 2)).toBeCloseTo(10);
    expect(sleepAverageHours([], "2026-10-26", 3)).toBeNull();
  });

  const base = {
    loadKind: "barbell" as const,
    scheme: { setsMin: 3, setsMax: 3, repsMin: 10, repsMax: 10, rirTarget: 2 },
    lastSets: [10, 10, 10].map((reps) => ({ weight: 95, reps, rir: 2 })),
    lastRepsMax: 10,
    readiness: "normal" as const,
    isDeload: false,
  };

  it("holds the load when 3-night sleep is under 6.5 h", () => {
    expect(suggestLoad({ ...base, sleepAverageHours: 6.4 })).toMatchObject({
      load: 95,
      kind: "same",
      held: true,
    });
    expect(suggestLoad({ ...base, sleepAverageHours: 6.5 })).toMatchObject({
      load: 100,
      kind: "increase",
    });
    expect(suggestLoad({ ...base, sleepAverageHours: null })).toMatchObject({
      load: 100,
    });
  });

  it("lets the minimum sleep come from settings", () => {
    const settings = {
      ...DEFAULT_PROGRAM_SETTINGS,
      sleepMinHoursForIncrease: 7,
    };
    expect(
      suggestLoad({ ...base, sleepAverageHours: 6.8, settings }).kind,
    ).toBe("same");
  });

  it("deload and readiness still lock with good sleep", () => {
    expect(
      suggestLoad({ ...base, sleepAverageHours: 8, isDeload: true }).kind,
    ).toBe("same");
    expect(
      suggestLoad({ ...base, sleepAverageHours: 8, readiness: "hold" }).kind,
    ).toBe("same");
  });
});

describe("Phase A: knee-off streak", () => {
  it("counts knee-off days in a row back from today, or from yesterday", () => {
    const days = [
      { date: "2026-10-24", status: "knee_off" as const },
      { date: "2026-10-25", status: "knee_off" as const },
      { date: "2026-10-26", status: "knee_off" as const },
    ];
    expect(kneeOffStreak(days, "2026-10-26")).toBe(3);
    expect(kneeOffStreak(days, "2026-10-27")).toBe(3);
    expect(
      kneeOffStreak(
        [...days, { date: "2026-10-27", status: "normal" }],
        "2026-10-27",
      ),
    ).toBe(0);
    expect(
      kneeOffStreak([{ date: "2026-10-24", status: "knee_off" }], "2026-10-26"),
    ).toBe(0);
  });
});

describe("Phase A: gates on a hold day and week windows", () => {
  const ctx: PlanContext = {
    week: 11,
    gates: [gate("barbell", "2026-10-20")],
    date: "2026-11-02",
    readiness: "hold",
    block: block("b1", "Block 1", 10, 12, {
      setsMin: 3,
      setsMax: 4,
      repsMin: 10,
      repsMax: 12,
    }),
    sourceBlock: null,
    weekIndexInBlock: 1,
    isDeload: false,
  };

  it("runs the substitute instead of cleared gated work on a hold day", () => {
    const squat = exercise({
      name: "Barbell Pin Squat",
      gateKey: "barbell",
      substituteName: "Goblet Box Squat",
      substituteLoadKind: "dumbbell",
    });
    expect(planExercise(squat, ctx)).toMatchObject({
      status: "substitute",
      name: "Goblet Box Squat",
    });
    expect(planExercise(squat, { ...ctx, readiness: "normal" })).toMatchObject({
      status: "active",
      name: "Barbell Pin Squat",
    });
  });

  it("hides cleared gated work with no substitute on a hold day", () => {
    const nordic = exercise({ name: "Nordic", gateKey: "barbell" });
    expect(planExercise(nordic, ctx)).toMatchObject({
      status: "readiness_hidden",
      lockedReason: "Off on a repeat-loads day",
    });
  });

  it("keeps an exercise to its from/until weeks (rear foot elevated from week 11)", () => {
    expect(inWeekWindow({ fromWeek: null, untilWeek: 10 }, 10)).toBe(true);
    expect(inWeekWindow({ fromWeek: null, untilWeek: 10 }, 11)).toBe(false);
    expect(inWeekWindow({ fromWeek: 11, untilWeek: null }, 10)).toBe(false);
    expect(inWeekWindow({ fromWeek: 11, untilWeek: null }, 12)).toBe(true);
  });

  it("drops out-of-window exercises from the day plan", () => {
    const p = testProgram();
    const monday = p.sessions.find((s) => s.id === "b1-mon")!;
    monday.exercises = [
      exercise({ name: "Split Squat", untilWeek: 10 }),
      exercise({ name: "RFE Split Squat", fromWeek: 11, order: 1 }),
    ];
    expect(
      buildDayPlan(p, "2026-10-26", "normal").sessions[0]!.exercises.map(
        (e) => e.name,
      ),
    ).toEqual(["Split Squat"]);
    expect(
      buildDayPlan(p, "2026-11-02", "normal").sessions[0]!.exercises.map(
        (e) => e.name,
      ),
    ).toEqual(["RFE Split Squat"]);
  });
});

describe("Phase A: upper rows and the leg block", () => {
  function programWithUpper() {
    const p = withGate(testProgram(), "barbell_squat", null);
    const monday = p.sessions.find((s) => s.id === "b1-mon")!;
    monday.exercises = [
      ...monday.exercises,
      exercise({
        name: "Lateral Raise",
        blockPart: "upper",
        primaryMuscle: null,
        loadKind: "dumbbell",
        setsMin: 3,
        setsMax: 3,
        repsMin: 15,
        repsMax: 20,
        rirTarget: 2,
        order: 30,
      }),
    ];
    return p;
  }

  it("takes one set off everything on a deload week (program v1)", () => {
    const p = withGate(programWithUpper(), "barbell_squat", "2026-10-01");
    const plan = buildDayPlan(p, "2026-11-16", "normal").sessions[0]!;
    const sets = Object.fromEntries(
      plan.exercises.map((e) => [e.name, e.sets]),
    );
    expect(sets).toMatchObject({ "Barbell Pin Squat": 3, "Lateral Raise": 2 });
  });

  it("runs upper lifts through double progression too", () => {
    const p = programWithUpper();
    const day = buildDayPlan(p, "2026-10-26", "normal");
    const plan = (sets: { weight: number; reps: number; rir: number }[]) =>
      buildLiftLoggerPlan({
        program: p,
        planned: day.sessions[0]!,
        info: day.info,
        readiness: "normal",
        history: { "lateral raise": { sessionDate: "2026-10-16", sets } },
        upper: null,
      }).exercises.find((e) => e.exerciseName === "Lateral Raise")!;
    const same = plan([{ weight: 10, reps: 15, rir: 2 }]);
    expect(same).toMatchObject({
      targetWeight: 10,
      targetReps: 20,
      targetSets: 3,
      program: true,
    });
    expect(same.notes).toContain("15-20 reps.");
    expect(
      plan([
        { weight: 10, reps: 20, rir: 2 },
        { weight: 10, reps: 20, rir: 2 },
        { weight: 10, reps: 20, rir: 2 },
      ]),
    ).toMatchObject({ targetWeight: 12.5 });
  });

  it("marks a loaded upper lift with no history as Find load", () => {
    const p = programWithUpper();
    const day = buildDayPlan(p, "2026-10-26", "normal");
    const plan = buildLiftLoggerPlan({
      program: p,
      planned: day.sessions[0]!,
      info: day.info,
      readiness: "normal",
      history: {},
      upper: null,
    });
    const raise = plan.exercises.find(
      (e) => e.exerciseName === "Lateral Raise",
    )!;
    expect(raise.notes).toMatch(/^Find load/);
  });

  it("keeps upper work on a knee day off and swaps every leg row for the ROM block", () => {
    const p = programWithUpper();
    const day = buildDayPlan(p, "2026-10-26", "knee_off");
    const plan = buildLiftLoggerPlan({
      program: p,
      planned: day.sessions[0]!,
      info: day.info,
      readiness: "knee_off",
      history: {},
      upper: null,
      settings: { ...DEFAULT_PROGRAM_SETTINGS, kneeOffBlockMinutes: 20 },
    });
    expect(plan.exercises.map((e) => e.exerciseName)).toEqual([
      "Knee day off: ROM + easy walk",
      "Lateral Raise",
    ]);
    expect(plan.exercises[0]!.targetSeconds).toBe(1200);
  });

  it("does not count upper sets as hard leg sets", () => {
    const index = legExerciseIndex(
      programWithUpper().sessions.flatMap((s) => s.exercises),
    );
    expect(index.get("lateral raise")?.primaryMuscle ?? null).toBeNull();
  });
});

describe("Phase A: milestones with a return-to-sport block", () => {
  it("does not list week 39 twice", () => {
    const p = testProgram();
    p.blocks.push(block("rts", "Return to Sport + Maintenance", 39, 520));
    const labels = programMilestones(p)
      .filter((m) => m.week === 39)
      .map((m) => m.label);
    expect(labels).toEqual(["Return to Sport + Maintenance"]);
    expect(programMilestones(p).find((m) => m.week === 39)?.date).toBe(
      "2027-05-17",
    );
  });
});
