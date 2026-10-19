import { describe, expect, it } from "vitest";
import {
  formatPrescription,
  formatShortDate,
  hardSetBand,
  limbSymmetryPct,
  sessionCompletion,
  SKIP_LABELS,
  ratioTone,
} from "./helpers";
import {
  isForceSet,
  setLabel,
  withRightRepsFromLeft,
  formatLastPerformance,
  planExerciseSets,
} from "../strength/helpers";

describe("sessionCompletion", () => {
  const base = {
    today: "2026-10-21",
    liftDates: new Set(["2026-10-19"]),
    rideDates: new Set(["2026-10-20"]),
  };

  it("marks logged lifts and rides done", () => {
    expect(
      sessionCompletion({ ...base, type: "lift", date: "2026-10-19" }),
    ).toBe("done");
    expect(
      sessionCompletion({ ...base, type: "peloton", date: "2026-10-20" }),
    ).toBe("done");
  });

  it("makes a past unlogged session visible as missed", () => {
    expect(
      sessionCompletion({ ...base, type: "peloton", date: "2026-10-19" }),
    ).toBe("missed");
  });

  it("separates today from later days", () => {
    expect(
      sessionCompletion({ ...base, type: "lift", date: "2026-10-21" }),
    ).toBe("today");
    expect(
      sessionCompletion({ ...base, type: "lift", date: "2026-10-23" }),
    ).toBe("planned");
  });

  it("does not track test days or walk-jog", () => {
    expect(
      sessionCompletion({ ...base, type: "test", date: "2026-10-18" }),
    ).toBe("none");
    expect(
      sessionCompletion({ ...base, type: "walk_jog", date: "2026-10-18" }),
    ).toBe("none");
  });
});

describe("formatPrescription", () => {
  const scheme = {
    setsMin: 3,
    setsMax: 4,
    repsMin: 10,
    repsMax: 12,
    rirTarget: 2,
  };
  const exercise = {
    measure: "reps",
    sideMode: "bilateral",
    secondsTarget: null,
    tempo: null,
  } as const;

  it("formats reps, RIR, per-leg and tempo", () => {
    expect(formatPrescription({ sets: 3, scheme, exercise })).toBe(
      "3 x 10–12 @ RIR 2",
    );
    expect(
      formatPrescription({
        sets: 3,
        scheme: { ...scheme, repsMin: 12, repsMax: 12 },
        exercise: { ...exercise, sideMode: "per_leg", tempo: "3-1-1" },
      }),
    ).toBe("3 x 12 @ RIR 2 per leg, 3-1-1");
  });

  it("formats time and force work", () => {
    expect(
      formatPrescription({
        sets: 3,
        scheme,
        exercise: { ...exercise, measure: "time", secondsTarget: 45 },
      }),
    ).toBe("3 x 45 s");
    expect(
      formatPrescription({
        sets: 1,
        scheme,
        exercise: { ...exercise, measure: "time", secondsTarget: 300 },
      }),
    ).toBe("1 x 5 min");
    expect(
      formatPrescription({
        sets: 5,
        scheme,
        exercise: {
          ...exercise,
          measure: "force",
          sideMode: "per_leg",
          secondsTarget: 5,
        },
      }),
    ).toBe("5 x 5 s, peak N per leg");
  });

  it("formats per-side and distance work (program v1)", () => {
    expect(
      formatPrescription({
        sets: 3,
        scheme: { ...scheme, repsMin: 10, repsMax: 10, rirTarget: null },
        exercise: { ...exercise, sideMode: "per_side" },
      }),
    ).toBe("3 x 10 per side");
    expect(
      formatPrescription({
        sets: 3,
        scheme,
        exercise: {
          ...exercise,
          measure: "distance",
          sideMode: "per_side",
          distanceMetersTarget: 30,
        },
      }),
    ).toBe("3 x 30 m per side");
  });
});

describe("small display rules", () => {
  it("bands weekly hard leg sets against 12-16", () => {
    const target = { min: 12, max: 16 };
    expect(hardSetBand(11, target)).toBe("under");
    expect(hardSetBand(12, target)).toBe("on");
    expect(hardSetBand(16, target)).toBe("on");
    expect(hardSetBand(17, target)).toBe("over");
  });

  it("gives left as a percent of right", () => {
    expect(limbSymmetryPct(410, 520)).toBe(79);
    expect(limbSymmetryPct(null, 520)).toBeNull();
    expect(limbSymmetryPct(410, 0)).toBeNull();
  });

  it("formats dates without a timezone shift", () => {
    expect(formatShortDate("2026-10-26")).toBe("Oct 26");
  });
});

describe("per-leg logging (left sets the right leg's reps)", () => {
  const sets = [
    { side: "left" as const, reps: "12", done: false },
    { side: "right" as const, reps: "12", done: false },
    { side: "left" as const, reps: "12", done: false },
    { side: "right" as const, reps: "12", done: false },
  ];
  const group = [0, 1, 2, 3];

  it("copies a left set's reps to the matching right set", () => {
    const next = withRightRepsFromLeft(sets, group, 2, "9");
    expect(next.map((s) => s.reps)).toEqual(["12", "12", "12", "9"]);
  });

  it("leaves a ticked right set alone", () => {
    const ticked = sets.map((s, i) => (i === 1 ? { ...s, done: true } : s));
    expect(withRightRepsFromLeft(ticked, group, 0, "8")[1]?.reps).toBe("12");
  });

  it("ignores right-leg edits and blank or bad input", () => {
    expect(withRightRepsFromLeft(sets, group, 1, "8")).toBe(sets);
    expect(withRightRepsFromLeft(sets, group, 0, "")).toBe(sets);
    expect(withRightRepsFromLeft(sets, group, 0, "x")).toBe(sets);
  });

  it("labels sets per leg", () => {
    expect(setLabel(sets, group, 0, 1)).toBe("L1");
    expect(setLabel(sets, group, 3, 4)).toBe("R2");
    expect(setLabel([{}], [0], 0, 3)).toBe("3");
  });

  it("marks isometric sets by their newton field", () => {
    expect(isForceSet({ peakForceNewtons: "" })).toBe(true);
    expect(isForceSet({})).toBe(false);
  });

  it("formats last time per leg, and peak newtons for isometrics", () => {
    expect(
      formatLastPerformance({
        sessionDate: "2026-10-19",
        sets: [
          { weight: 10, reps: 12, durationSeconds: null, side: "left" },
          { weight: 10, reps: 12, durationSeconds: null, side: "right" },
          { weight: 10, reps: 11, durationSeconds: null, side: "left" },
          { weight: 10, reps: 12, durationSeconds: null, side: "right" },
        ],
      }),
    ).toBe("L 10 x 12, 11 · R 10 x 12, 12");
    expect(
      formatLastPerformance({
        sessionDate: "2026-10-19",
        sets: [
          {
            weight: null,
            reps: null,
            durationSeconds: 5,
            side: "left",
            peakForceNewtons: 380,
          },
          {
            weight: null,
            reps: null,
            durationSeconds: 5,
            side: "left",
            peakForceNewtons: 410,
          },
          {
            weight: null,
            reps: null,
            durationSeconds: 5,
            side: "right",
            peakForceNewtons: 520,
          },
        ],
      }),
    ).toBe("L 410 N · R 520 N");
  });
});

describe("plan rows for the logger", () => {
  const base = {
    exerciseName: "Cuff Knee Extension",
    exerciseOrder: 0,
    targetSets: 2,
    targetReps: 12,
    targetWeight: 7.5,
    targetRir: 2,
    notes: null,
  };

  it("alternates left and right with the engine's load", () => {
    const rows = planExerciseSets(
      { ...base, sideMode: "per_leg", program: true },
      undefined,
    );
    expect(rows.map((r) => [r.side, r.weight, r.reps])).toEqual([
      ["left", "7.5", "12"],
      ["right", "7.5", "12"],
      ["left", "7.5", "12"],
      ["right", "7.5", "12"],
    ]);
  });

  it("gives isometrics seconds and an empty newton field", () => {
    const rows = planExerciseSets(
      {
        ...base,
        targetSets: 1,
        sideMode: "per_leg",
        measure: "force",
        targetSeconds: 5,
        program: true,
      },
      undefined,
    );
    expect(rows[0]).toMatchObject({
      durationSeconds: "5",
      peakForceNewtons: "",
      reps: "",
      weight: "",
    });
  });

  it("keeps the last-logged prefill for template exercises", () => {
    const rows = planExerciseSets(
      {
        ...base,
        exerciseName: "Barbell Bench Press",
        targetSets: 1,
        targetReps: 8,
        targetWeight: 165,
      },
      {
        sessionDate: "2026-10-12",
        sets: [{ weight: 175, reps: 8, durationSeconds: null }],
      },
    );
    expect(rows[0]).toMatchObject({ weight: "175", reps: "8" });
    expect(rows[0]).not.toHaveProperty("side");
  });
});

describe("explicit skips (Phase A)", () => {
  const base = {
    today: "2026-10-21",
    liftDates: new Set<string>(),
    rideDates: new Set<string>(),
  };

  it("shows a skip or red-flag stop instead of missed", () => {
    expect(
      sessionCompletion({
        ...base,
        type: "lift",
        date: "2026-10-19",
        outcome: "skipped",
      }),
    ).toBe("skipped");
    expect(
      sessionCompletion({
        ...base,
        type: "lift",
        date: "2026-10-21",
        outcome: "stopped",
      }),
    ).toBe("stopped");
    expect(
      sessionCompletion({
        ...base,
        type: "lift",
        date: "2026-10-19",
        outcome: null,
      }),
    ).toBe("missed");
  });
});

describe("skip labels", () => {
  it("names every skip reason and red flag", () => {
    for (const key of [
      "time",
      "knee",
      "sick",
      "travel",
      "other",
      "giving_way",
      "locking",
      "sharp_pain",
    ]) {
      expect(SKIP_LABELS[key]).toBeTruthy();
    }
  });
});

describe("scorecard tone", () => {
  it("marks met, short, or no data", () => {
    expect(ratioTone(3, 3)).toBe("met");
    expect(ratioTone(4, 3)).toBe("met");
    expect(ratioTone(2, 3)).toBe("short");
    expect(ratioTone(null, 2)).toBe("none");
    expect(ratioTone(1, 0)).toBe("none");
  });
});
