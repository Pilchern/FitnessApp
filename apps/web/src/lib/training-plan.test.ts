import { describe, expect, it } from "vitest";
import { nickAiPlanContext, weeksPostOp } from "./training-plan";

describe("weeksPostOp", () => {
  it("matches the plan doc's post-op day 53 on 2026-10-09", () => {
    expect(weeksPostOp(new Date("2026-10-09T12:00:00Z"))).toBe(7);
    expect(weeksPostOp(new Date("2026-10-12T12:00:00Z"))).toBe(8);
    expect(weeksPostOp(new Date("2026-08-01T12:00:00Z"))).toBe(0);
  });

  it("puts the current week into the AI plan context", () => {
    expect(nickAiPlanContext(new Date("2026-10-24T12:00:00Z"))).toContain(
      "about 9 weeks post-op",
    );
  });

  it("matches program v2: legs and upper on lift days, impact still parked", () => {
    const context = nickAiPlanContext(new Date("2026-10-24T12:00:00Z"));
    expect(context).toContain(
      "No running, jumping, plyometrics, or VO2 intervals until cleared.",
    );
    expect(context).toContain("legs and upper body");
    expect(context).toContain("no squat past 90 degrees");
    expect(context).not.toMatch(/upper body only|lower-body loading\./i);
  });
});
