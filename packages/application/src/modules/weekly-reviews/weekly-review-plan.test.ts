import { describe, expect, it } from "vitest";
import { GENERIC_TRAINING_PLAN } from "../training/training-plan";
import { calculateWeeklyReviewScore } from "./weekly-review-helpers";

const summary = {
  averageWeightLb: null,
  waistIn: null,
  liftsCompleted: 3,
  ridesCompleted: 3,
  zone2Minutes: 105,
  vo2Completed: false,
  sleepAverageHours: 8,
  alcoholTotal: 0,
} as never;

const rehabPlan = {
  ...GENERIC_TRAINING_PLAN,
  weeklyZone2TargetMinutes: 105,
  vo2Required: false,
};

describe("calculateWeeklyReviewScore with a plan", () => {
  it("scores a perfect rehab week 100 without a VO2 session", () => {
    const result = calculateWeeklyReviewScore({
      summary,
      confidence: 10,
      plan: rehabPlan,
    });
    expect(result.scoreDetails.totalScore).toBe(100);
    expect(result.scoreDetails.components.some((c) => c.key === "vo2")).toBe(
      false,
    );
  });

  it("measures Zone 2 against the plan target", () => {
    const result = calculateWeeklyReviewScore({
      summary: { ...(summary as object), zone2Minutes: 52 } as never,
      confidence: 10,
      plan: rehabPlan,
    });
    const zone2 = result.scoreDetails.components.find((c) => c.key === "zone2");
    expect(zone2?.detail).toContain("/ 105");
    expect(zone2?.score).toBe(5);
  });

  it("keeps the generic baseline when no plan is given", () => {
    const result = calculateWeeklyReviewScore({ summary, confidence: 10 });
    expect(result.scoreDetails.components.some((c) => c.key === "vo2")).toBe(
      true,
    );
  });
});
