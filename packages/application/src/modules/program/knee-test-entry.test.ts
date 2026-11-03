import { describe, expect, it } from "vitest";
import {
  clinicVisitRows,
  craneSummary,
  kneeTestEntryRows,
  mmtGrade,
  type KneeTestEntry,
} from "./knee-test-entry";
import { quadLsiTrend } from "./knee-tests";

const none = { L: [], R: [] };

function entry(over: Partial<KneeTestEntry> = {}): KneeTestEntry {
  return {
    testDate: "2026-11-08",
    angleDeg: 90,
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
    expect(quadLsiTrend(tests)).toEqual([{ date: "2026-11-08", lsi: 75 }]);
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
