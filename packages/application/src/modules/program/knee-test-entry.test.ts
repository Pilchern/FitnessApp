import { describe, expect, it } from "vitest";
import {
  clinicVisitRows,
  craneSummary,
  kneeTestEntryRows,
  mmtGrade,
  type KneeTestEntry,
} from "./knee-test-entry";
import { craneTestDue, legExtensionSymmetry, quadLsiTrend } from "./knee-tests";

const none = { L: [], R: [] };

function entry(over: Partial<KneeTestEntry> = {}): KneeTestEntry {
  return {
    testDate: "2026-11-08",
    angleDeg: 90,
    legExtension: { loadLb: null, L: null, R: null },
    strapNote: null,
    quadWarmup: none,
    quad: none,
    ham: none,
    flexionActive: null,
    flexionPassive: null,
    extension: null,
    kneeGirth: { L: null, R: null },
    thighGirth: { L: null, R: null },
    heelHeight: null,
    sitToStand: { L: null, R: null },
    heelToButt: { L: null, R: null },
    stepDownLeftClean: null,
    walkingAsymmetry: null,
    walkingSpeed: null,
    steps: null,
    effusionGrade: null,
    aclRsi: null,
    hops: { single: none, triple: none, crossover: none, timed6m: none },
    notes: null,
    ...over,
  };
}

describe("kneeTestEntryRows", () => {
  it("writes crane trials with warm-ups under their own type", () => {
    const { rows, replaceTypes } = kneeTestEntryRows(
      entry({
        strapNote: "2 fingers above malleoli",
        quadWarmup: { L: [150, 200], R: [200, 250] },
        quad: { L: [300, 320, null], R: [400, 410, 405] },
      }),
    );
    expect(rows.filter((r) => r.testType === "quad_iso_90")).toHaveLength(5);
    expect(
      rows.filter((r) => r.testType === "quad_iso_90_warmup"),
    ).toHaveLength(4);
    expect(rows.find((r) => r.testType === "quad_iso_90")?.notes).toBe(
      "strap: 2 fingers above malleoli",
    );
    expect(
      rows.find(
        (r) =>
          r.testType === "quad_iso_90" && r.side === "L" && r.repIndex === 2,
      )?.value,
    ).toBe(320);
    expect(replaceTypes).toEqual([
      "quad_iso_90",
      "quad_iso_90_warmup",
      "ham_iso_90",
    ]);
  });

  it("keeps warm-ups out of the LSI maths", () => {
    const { rows } = kneeTestEntryRows(
      entry({
        quadWarmup: { L: [900, 900], R: [100, 100] },
        quad: { L: [300], R: [400] },
      }),
    );
    const tests = rows.map((r) => ({ ...r, source: "fitness_app" }));
    expect(quadLsiTrend(tests)).toMatchObject([
      { date: "2026-11-08", lsi: 75 },
    ]);
  });

  it("uses the angle in the type and only replaces sections with values", () => {
    const { rows, replaceTypes } = kneeTestEntryRows(
      entry({
        angleDeg: 60,
        quad: { L: [250], R: [] },
        flexionActive: 128,
        effusionGrade: 1,
        hops: {
          single: { L: [120], R: [140] },
          triple: none,
          crossover: none,
          timed6m: { L: [2.4], R: [2.1] },
        },
      }),
    );
    expect(rows.map((r) => r.testType)).toEqual([
      "quad_iso_60",
      "flexion_active",
      "effusion_stroke",
      "hop_single",
      "hop_single",
      "hop_6m_timed",
      "hop_6m_timed",
    ]);
    expect(rows[0]?.notes).toBe("60°");
    expect(rows.find((r) => r.testType === "effusion_stroke")?.notes).toBe(
      "trace",
    );
    expect(replaceTypes).toContain("flexion_passive");
    expect(replaceTypes).not.toContain("knee_girth");
    expect(replaceTypes).toContain("hop_triple");
  });

  it("writes the biweekly tests with the tracker's types", () => {
    const { rows, replaceTypes } = kneeTestEntryRows(
      entry({
        heelHeight: 0,
        sitToStand: { L: 8, R: 10 },
        heelToButt: { L: 12, R: 10 },
        stepDownLeftClean: false,
      }),
    );
    expect(rows.map((r) => `${r.testType}:${r.side ?? ""}:${r.value}`)).toEqual(
      [
        "heel_height::0",
        "single_leg_sit_to_stand:L:8",
        "single_leg_sit_to_stand:R:10",
        "heel_to_butt:L:12",
        "heel_to_butt:R:10",
        "step_down:L:0",
      ],
    );
    expect(replaceTypes).toContain("step_down");
  });

  it("returns nothing for an empty entry", () => {
    expect(kneeTestEntryRows(entry())).toEqual({ rows: [], replaceTypes: [] });
  });
});

describe("craneSummary", () => {
  it("takes the best of three, LSI, H:Q and the spread flag", () => {
    const s = craneSummary(
      { L: [300, 380, 310], R: [400, 420, 410] },
      { L: [150, 160, null], R: [200, null, null] },
      65,
    );
    expect(s.quad.L).toEqual({ best: 380, spread: 80, spreadFlag: true });
    expect(s.quad.R).toEqual({ best: 420, spread: 20, spreadFlag: false });
    expect(s.lsi).toBe(90.5);
    expect(s.hq).toEqual({ L: 0.42, R: 0.48 });
  });

  it("handles a missing side", () => {
    const s = craneSummary({ L: [300], R: [] }, none, 65);
    expect(s.lsi).toBeNull();
    expect(s.quad.L.spread).toBeNull();
    expect(s.quad.R.best).toBeNull();
  });
});

describe("clinicVisitRows", () => {
  it("writes a visit marker, ROM, MMT and LEFS", () => {
    const { rows, replaceTypes } = clinicVisitRows({
      visitDate: "2026-11-05",
      provider: "Dr. PT",
      flexionActive: 130,
      flexionPassive: null,
      extension: 0,
      mmt: "4+/5",
      lefs: 55,
      lefsMax: 80,
      notes: "Cleared pogos",
    });
    expect(rows.map((r) => [r.testType, r.value, r.notes])).toEqual([
      ["clinic_visit", 1, "provider: Dr. PT; Cleared pogos"],
      ["flexion_active", 130, "provider: Dr. PT"],
      ["extension", 0, "provider: Dr. PT"],
      ["manual_muscle_test", 4.5, "4+/5"],
      ["lefs", 55, "of 80"],
    ]);
    expect(replaceTypes).toContain("flexion_passive");
  });

  it("reads MMT grades", () => {
    expect(mmtGrade("4/5")).toBe(4);
    expect(mmtGrade("4-/5")).toBe(3.5);
    expect(mmtGrade("5")).toBe(5);
    expect(mmtGrade("good")).toBeNull();
  });
});

describe("single-leg leg extension test (v2.19)", () => {
  it("stores reps and the shared load per leg, and replaces only that section", () => {
    const { rows, replaceTypes } = kneeTestEntryRows(
      entry({ legExtension: { loadLb: 40, L: 11, R: 13 } }),
    );
    expect(rows.map((r) => [r.testType, r.side, r.value, r.unit])).toEqual([
      ["sl_leg_ext_reps", "L", 11, "reps"],
      ["sl_leg_ext_load", "L", 40, "lb"],
      ["sl_leg_ext_reps", "R", 13, "reps"],
      ["sl_leg_ext_load", "R", 40, "lb"],
    ]);
    expect(replaceTypes).toEqual(["sl_leg_ext_reps", "sl_leg_ext_load"]);
  });

  it("reads symmetry as L reps / R reps at the same load", () => {
    const { rows } = kneeTestEntryRows(
      entry({ legExtension: { loadLb: 40, L: 11, R: 13 } }),
    );
    const tests = rows.map((r) => ({
      testDate: r.testDate,
      testType: r.testType,
      side: r.side,
      value: r.value,
      unit: r.unit,
      repIndex: r.repIndex,
      source: "fitness_app",
      notes: r.notes,
    }));
    expect(legExtensionSymmetry(tests)).toEqual([
      {
        date: "2026-11-08",
        loadL: 40,
        loadR: 40,
        repsL: 11,
        repsR: 13,
        symmetry: 84.6,
      },
    ]);
  });

  it("gives no symmetry when the loads differ", () => {
    const t = (testType: string, side: "L" | "R", value: number) => ({
      testDate: "2026-11-15",
      testType,
      side,
      value,
      unit: "x",
      repIndex: 1,
      source: "fitness_app",
      notes: null,
    });
    const [r] = legExtensionSymmetry([
      t("sl_leg_ext_reps", "L", 10),
      t("sl_leg_ext_reps", "R", 12),
      t("sl_leg_ext_load", "L", 35),
      t("sl_leg_ext_load", "R", 40),
    ]);
    expect(r?.symmetry).toBeNull();
  });
});

describe("craneTestDue", () => {
  const crane = (testDate: string) => ({
    testDate,
    testType: "quad_iso_90",
    side: "L" as const,
    value: 300,
    unit: "N",
    repIndex: 1,
    source: "pt_tracker",
    notes: null,
  });
  it("is due with no crane test or one 28+ days old", () => {
    expect(craneTestDue([], "2026-11-15")).toBe(true);
    expect(craneTestDue([crane("2026-10-18")], "2026-11-15")).toBe(true);
  });
  it("is not due inside 28 days", () => {
    expect(craneTestDue([crane("2026-10-19")], "2026-11-15")).toBe(false);
  });
});
