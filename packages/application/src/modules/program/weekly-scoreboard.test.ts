import { describe, expect, it } from "vitest";
import type { KneeTest } from "@fitness-app/domain";
import { weeklyScoreboard } from "../../index";

const W10 = { week: 10, start: "2026-10-26", end: "2026-11-01" };
const W11 = { week: 11, start: "2026-11-02", end: "2026-11-08" };

const scale = (measuredOn: string, weightLb: number) => ({
  measuredOn,
  weightLb,
  waistIn: null,
  source: { sourceType: "imported" },
});
const tape = (
  measuredOn: string,
  v: { waistIn?: number; thighLIn?: number; thighRIn?: number },
) => ({
  measuredOn,
  weightLb: null,
  waistIn: v.waistIn ?? null,
  thighLIn: v.thighLIn ?? null,
  thighRIn: v.thighRIn ?? null,
  source: { sourceType: "manual" },
});
const knee = (
  testDate: string,
  testType: string,
  side: "L" | "R" | null,
  value: number,
  repIndex = 1,
): KneeTest => ({
  testDate,
  testType,
  side,
  value,
  unit: testType === "walking_asymmetry" ? "%" : "N",
  repIndex,
  source: "pt_tracker",
  notes: null,
});

describe("weeklyScoreboard", () => {
  it("builds one row per week with every cell, and nulls where there is no data", () => {
    const rows = weeklyScoreboard({
      weeks: [W10, W11],
      body: [
        scale("2026-10-27", 178.0),
        scale("2026-10-29", 178.4),
        scale("2026-11-03", 179.0),
        scale("2026-11-05", 179.4),
        tape("2026-11-07", { waistIn: 34.8, thighLIn: 21.9, thighRIn: 23.1 }),
      ],
      nutrition: [
        { logDate: "2026-11-02", calories: 2400, proteinGrams: 195 },
        { logDate: "2026-11-03", calories: 2500, proteinGrams: 205 },
        { logDate: "2026-11-04", calories: null, proteinGrams: 150 },
      ],
      kneeTests: [
        knee("2026-11-08", "quad_iso_90", "L", 300, 1),
        knee("2026-11-08", "quad_iso_90", "L", 320, 2),
        knee("2026-11-08", "quad_iso_90", "R", 400, 1),
        knee("2026-11-08", "walking_asymmetry", null, 6.5),
      ],
      activity: [
        { metricDate: "2026-11-02", steps: 8000 },
        { metricDate: "2026-11-03", steps: 9000 },
      ],
      checkins: [{ weekStart: "2026-10-26", walkingAsymmetryPct: 9 }],
    });

    expect(rows[0]).toMatchObject({
      week: 10,
      weightAvgLb: 178.2,
      weightChangeLb: null,
      kcalAvg: null,
      nutritionDays: 0,
      quadLsi: null,
      thighLIn: null,
      stepsAvg: null,
      // Falls back to the hand-typed check-in.
      walkingAsymmetryPct: 9,
    });
    expect(rows[1]).toMatchObject({
      week: 11,
      weightAvgLb: 179.2,
      weightChangeLb: 1,
      kcalAvg: 2450,
      proteinAvg: 183,
      nutritionDays: 2,
      quadPeakLeft: 320,
      quadPeakRight: 400,
      quadPeakUnit: "N",
      quadLsi: 80,
      thighLIn: 21.9,
      thighRIn: 23.1,
      waistIn: 34.8,
      stepsAvg: 8500,
      walkingAsymmetryPct: 6.5,
    });
  });

  it("does not count tape rows as weigh-ins", () => {
    const [row] = weeklyScoreboard({
      weeks: [W10],
      body: [{ ...tape("2026-10-27", {}), weightLb: 150 }],
      nutrition: [],
      kneeTests: [],
      activity: [],
      checkins: [],
    });
    expect(row?.weightAvgLb).toBeNull();
  });
});
