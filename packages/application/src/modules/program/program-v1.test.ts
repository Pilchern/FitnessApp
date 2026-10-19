import { describe, expect, it } from "vitest";
import type { ProgramBlock, TrainingProgram } from "@fitness-app/domain";
import { nextBlockStart, programWeekInfo } from "./program-calendar";
import { buildDayPlan, planExercise, type PlanContext } from "./program-plan";
import {
  legExerciseIndex,
  plannedSetCount,
  pullUpLoadCue,
  suggestHoldSeconds,
  suggestLoad,
  weeklyHardLegSets,
} from "./program-progression";
import {
  block,
  exercise,
  gate,
  session,
} from "./program-fixtures.test-helpers";

/** The v1 block layout (supabase/migrations/20261019200100_seed_program_v1.sql). */
function v1Blocks(): ProgramBlock[] {
  return [
    block("onramp", "On-ramp", 9, 9),
    block("b1", "Block 1 Build", 10, 12),
    block("d13", "Deload + Test", 13, 13, { sessionsFromBlockId: "b1" }),
    block("b2", "Block 2 Strength", 14, 17),
    block("d18", "Deload", 18, 18, { sessionsFromBlockId: "b2" }),
    block("b3", "Block 3 Heavy + Power", 19, 22),
    block("a", "Strength A", 23, 26),
    block("d27", "Deload + Test (week 27)", 27, 27, {
      sessionsFromBlockId: "a",
    }),
    block("b", "Power B", 28, 31),
    block("d32", "Deload + Test (week 32)", 32, 32, {
      sessionsFromBlockId: "b",
    }),
    block("a2", "Strength A2", 33, 36),
    block("taper", "Taper + RTS battery", 37, 38, {
      sessionsFromBlockId: "a2",
    }),
    block("rts", "Return to Sport + Maintenance", 39, 520, {
      activation: "gate",
      gateKey: "rts",
      fallbackBlockId: "a2",
    }),
    block("tri", "Triathlon (placeholder)", 39, 520, {
      activation: "manual",
    }),
  ];
}

function v1Program(overrides: Partial<TrainingProgram> = {}): TrainingProgram {
  return {
    id: "p",
    userId: "u",
    name: "ACL return",
    version: "program v1, 2026-10-19",
    weekAnchorDate: "2026-08-17",
    returnToSportWeek: 39,
    testDayUrl: null,
    notes: null,
    blocks: v1Blocks(),
    weeks: Array.from({ length: 30 }, (_, i) => i + 9).map((w) => ({
      weekNumber: w,
      isDeload: [13, 18, 27, 32, 37, 38].includes(w),
      notes: null,
    })),
    sessions: [],
    gates: [gate("rts")],
    ...overrides,
  };
}

describe("program v1: dates map to the right week and block", () => {
  const cases: [string, number, string, boolean][] = [
    ["2026-10-19", 9, "On-ramp", false],
    ["2026-10-26", 10, "Block 1 Build", false],
    ["2026-11-16", 13, "Deload + Test", true],
    ["2026-11-23", 14, "Block 2 Strength", false],
    ["2026-12-21", 18, "Deload", true],
    ["2026-12-28", 19, "Block 3 Heavy + Power", false],
    ["2027-01-25", 23, "Strength A", false],
    ["2027-05-16", 38, "Taper + RTS battery", true],
    // rts not cleared yet: Strength A2 keeps running.
    ["2027-05-17", 39, "Strength A2", false],
  ];
  it.each(cases)("%s is week %i, %s", (date, week, name, deload) => {
    const info = programWeekInfo(v1Program(), date);
    expect(info.week).toBe(week);
    expect(info.block?.name).toBe(name);
    expect(info.isDeload).toBe(deload);
  });

  it("flags deloads in weeks 13, 18, 27 and 32", () => {
    const p = v1Program();
    for (const [date, week] of [
      ["2026-11-16", 13],
      ["2026-12-21", 18],
      ["2027-02-22", 27],
      ["2027-03-29", 32],
    ] as const) {
      const info = programWeekInfo(p, date);
      expect(info.week).toBe(week);
      expect(info.isDeload).toBe(true);
    }
  });

  it("starts return to sport once the rts gate is cleared", () => {
    const p = v1Program({ gates: [gate("rts", "2027-05-17")] });
    expect(programWeekInfo(p, "2027-05-17").block?.name).toBe(
      "Return to Sport + Maintenance",
    );
    // Clearing it early does not pull return to sport before week 39.
    const early = v1Program({ gates: [gate("rts", "2027-01-01")] });
    expect(programWeekInfo(early, "2027-05-16").block?.name).toBe(
      "Taper + RTS battery",
    );
  });

  it("runs the manual triathlon block only once activated", () => {
    const p = v1Program();
    expect(programWeekInfo(p, "2027-06-07").block?.name).toBe("Strength A2");
    p.blocks = p.blocks.map((b) =>
      b.id === "tri" ? { ...b, activatedOn: "2027-06-01" } : b,
    );
    expect(programWeekInfo(p, "2027-05-31").block?.name).toBe("Strength A2");
    expect(programWeekInfo(p, "2027-06-07").block?.name).toBe(
      "Triathlon (placeholder)",
    );
  });
});

function ctx(overrides: Partial<PlanContext> = {}): PlanContext {
  return {
    gates: [gate("barbell"), gate("depth_past_90"), gate("nordic")],
    week: 14,
    date: "2026-11-23",
    readiness: "normal",
    block: null,
    sourceBlock: null,
    weekIndexInBlock: 1,
    isDeload: false,
    ...overrides,
  };
}

describe("program v1: gates and fallbacks", () => {
  const frontSquat = exercise({
    name: "Front Squat",
    category: "main",
    gateKey: "depth_past_90",
    extraGateKey: "barbell",
    substituteName: "Heel-Elevated Goblet Squat (to 90°)",
    substituteLoadKind: "dumbbell",
    substituteRepsMin: 8,
    substituteRepsMax: 8,
    setsMin: 4,
    setsMax: 4,
    repsMin: 6,
    repsMax: 8,
  });

  it("shows the fallback until both gates are cleared, then switches", () => {
    expect(planExercise(frontSquat, ctx())).toMatchObject({
      status: "substitute",
      name: "Heel-Elevated Goblet Squat (to 90°)",
      scheme: { repsMin: 8, repsMax: 8 },
    });
    const oneGate = ctx({
      gates: [gate("barbell", "2026-11-01"), gate("depth_past_90")],
    });
    expect(planExercise(frontSquat, oneGate).status).toBe("substitute");
    const both = ctx({
      gates: [
        gate("barbell", "2026-11-01"),
        gate("depth_past_90", "2026-11-20"),
      ],
    });
    expect(planExercise(frontSquat, both)).toMatchObject({
      status: "active",
      name: "Front Squat",
      scheme: { repsMin: 6, repsMax: 8 },
    });
  });

  it("names the closed gate when there is no fallback", () => {
    const hop = exercise({
      name: "Single-Leg Hop in Place",
      category: "plyo",
      gateKey: "plyo_single",
    });
    expect(
      planExercise(hop, ctx({ gates: [gate("plyo_single")] })).lockedReason,
    ).toBe("Waiting on gate: plyo_single");
  });
});

describe("program v1: deloads", () => {
  it("takes one set off non-plyo work and halves plyo sets", () => {
    const scheme = { setsMin: 4, setsMax: 4 };
    expect(plannedSetCount(scheme, 1, true, "main")).toBe(3);
    expect(plannedSetCount(scheme, 1, true, null)).toBe(3);
    expect(plannedSetCount(scheme, 1, true, "plyo")).toBe(2);
    expect(plannedSetCount({ setsMin: 3, setsMax: 3 }, 1, true, "plyo")).toBe(
      2,
    );
    expect(plannedSetCount(scheme, 1, false, "plyo")).toBe(4);
  });

  it("applies to upper work in a deload week too", () => {
    const p = v1Program();
    p.sessions = [
      session({
        id: "mon",
        blockId: "b1",
        dayOfWeek: 1,
        exercises: [
          exercise({
            name: "Barbell Bench Press",
            blockPart: "upper",
            category: "main",
            setsMin: 3,
            setsMax: 3,
            repsMin: 8,
            repsMax: 10,
          }),
        ],
      }),
    ];
    const plan = buildDayPlan(p, "2026-11-16", "normal");
    expect(plan.sessions[0]!.exercises[0]!.sets).toBe(2);
  });
});

describe("program v1: progression", () => {
  it("earns an increase at the exercise's target RIR, not a fixed 2", () => {
    const base = {
      loadKind: "dumbbell" as const,
      scheme: {
        setsMin: 2,
        setsMax: 3,
        repsMin: 12,
        repsMax: 12,
        rirTarget: 3,
      },
      lastRepsMax: 12,
      readiness: "normal" as const,
      isDeload: false,
    };
    const atTwo = suggestLoad({
      ...base,
      lastSets: [
        { weight: 30, reps: 12, rir: 2 },
        { weight: 30, reps: 12, rir: 2 },
      ],
    });
    expect(atTwo.kind).toBe("same");
    const atThree = suggestLoad({
      ...base,
      lastSets: [
        { weight: 30, reps: 12, rir: 3 },
        { weight: 30, reps: 12, rir: 4 },
      ],
    });
    expect(atThree).toMatchObject({ kind: "increase", load: 35 });
  });

  it("says Find load with no history", () => {
    const s = suggestLoad({
      loadKind: "barbell",
      scheme: {
        setsMin: 4,
        setsMax: 4,
        repsMin: 10,
        repsMax: 12,
        rirTarget: 2,
      },
      lastSets: [],
      lastRepsMax: null,
      readiness: "normal",
      isDeload: false,
    });
    expect(s).toMatchObject({ kind: "start", load: null });
    expect(s.reason).toMatch(/^Find load/);
  });

  it("adds 5 s to a hold once every set reached the target", () => {
    expect(
      suggestHoldSeconds({
        targetSeconds: 20,
        lastSets: [
          { weight: null, reps: null, rir: null, durationSeconds: 20 },
          { weight: null, reps: null, rir: null, durationSeconds: 22 },
        ],
        readiness: "normal",
        isDeload: false,
      }),
    ).toMatchObject({ kind: "increase", seconds: 25 });
    expect(
      suggestHoldSeconds({
        targetSeconds: 20,
        lastSets: [
          { weight: null, reps: null, rir: null, durationSeconds: 20 },
          { weight: null, reps: null, rir: null, durationSeconds: 15 },
        ],
        readiness: "normal",
        isDeload: false,
      }),
    ).toMatchObject({ kind: "same", seconds: 20 });
    expect(
      suggestHoldSeconds({
        targetSeconds: 20,
        lastSets: [
          { weight: null, reps: null, rir: null, durationSeconds: 25 },
        ],
        readiness: "normal",
        isDeload: true,
      }),
    ).toMatchObject({ kind: "same", held: true, seconds: 25 });
  });

  it("cues load on pull-ups at 30 total reps", () => {
    const sets = (reps: number[]) =>
      reps.map((r) => ({ weight: null, reps: r, rir: 1 }));
    expect(pullUpLoadCue("Pull-Up", sets([8, 8, 7, 7]))).toMatch(
      /^30 total reps/,
    );
    expect(pullUpLoadCue("Chin-Up", sets([5, 4, 4]))).toBeNull();
    expect(pullUpLoadCue("Dumbbell Row", sets([10, 10, 10]))).toBeNull();
    expect(
      pullUpLoadCue("Pull-Up", [
        { weight: 10, reps: 8, rir: 1 },
        { weight: 10, reps: 8, rir: 1 },
        { weight: 10, reps: 8, rir: 1 },
        { weight: 10, reps: 8, rir: 1 },
      ]),
    ).toBeNull();
  });
});

describe("program v1: hard quad set counter", () => {
  it("counts only exercises flagged counts_as_quad_set", () => {
    const index = legExerciseIndex([
      exercise({ name: "Barbell Pin Squat (to 90°)", countsAsQuadSet: true }),
      exercise({ name: "Barbell Hip Thrust", primaryMuscle: "glutes" }),
      exercise({
        name: 'DB Step-Up (12")',
        sideMode: "per_leg",
        countsAsQuadSet: true,
      }),
    ]);
    const set = (
      exerciseName: string,
      side: "left" | "right" | null = null,
    ) => ({
      exerciseName,
      reps: 10,
      rir: 2,
      weight: 100,
      isWarmup: false,
      side,
    });
    const count = weeklyHardLegSets(
      [
        {
          sessionDate: "2026-10-26",
          sets: [
            set("Barbell Pin Squat (to 90°)"),
            set("Barbell Pin Squat (to 90°)"),
            set("Barbell Hip Thrust"),
            set('DB Step-Up (12")', "left"),
            set('DB Step-Up (12")', "right"),
          ],
        },
      ] as never,
      index,
      { start: "2026-10-26", end: "2026-11-01" },
    );
    expect(count.quadSets).toBe(3);
    expect(count.total).toBe(4);
  });
});

describe("program v2: next block on the home header", () => {
  it("names the next block and its first day", () => {
    const p = v1Program();
    expect(nextBlockStart(p, "2026-10-19")).toMatchObject({
      label: "Block 1 Build",
      date: "2026-10-26",
    });
    expect(nextBlockStart(p, "2026-10-26")?.date).toBe("2026-11-16");
    expect(nextBlockStart(p, "2027-05-16")?.date).toBe("2027-05-17");
    expect(nextBlockStart(p, "2027-05-17")).toBeNull();
  });
});
