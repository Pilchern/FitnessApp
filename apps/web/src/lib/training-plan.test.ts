import { describe, expect, it } from "vitest";
import { weeksPostOp } from "./training-plan";

describe("weeksPostOp", () => {
  it("matches the plan doc's post-op day 53 on 2026-10-09", () => {
    expect(weeksPostOp(new Date("2026-10-09T12:00:00Z"))).toBe(7);
    expect(weeksPostOp(new Date("2026-10-12T12:00:00Z"))).toBe(8);
    expect(weeksPostOp(new Date("2026-08-01T12:00:00Z"))).toBe(0);
  });
});
