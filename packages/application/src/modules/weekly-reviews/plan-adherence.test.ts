import { describe, expect, it } from "vitest";
import {
  buildPlanAdherence,
  buildWeeklyReviewSummary,
  calculateWeeklyReviewScore,
  pickPlanAdherence,
} from "../../index";

const templates = [
  { templateType: "strength", scheduledDayOfWeek: 2, definition: {} },
  { templateType: "strength", scheduledDayOfWeek: 4, definition: {} },
  { templateType: "strength", scheduledDayOfWeek: null, definition: {} },
  {
    templateType: "cardio",
    scheduledDayOfWeek: 1,
    definition: { targetZone2Minutes: 40 },
  },
  {
    templateType: "cardio",
    scheduledDayOfWeek: 5,
    definition: { targetZone2Minutes: 60 },
  },
] as const;

describe("buildPlanAdherence", () => {
  it("counts scheduled templates and sums the Z2 target", () => {
    const out = buildPlanAdherence({
      templates: [...templates],
      habitIds: [],
      habitLogs: [],
    });
    expect(out).toEqual({
      liftsScheduled: 2,
      cardioScheduled: 2,
      zone2TargetMinutes: 100,
      habitCompletionPct: null,
    });
  });

  it("rates habit completion over habits x 7 days, once per day", () => {
    const log = (supplementId: string, logDate: string, taken = true) => ({
      supplementId,
      logDate,
      taken,
    });
    const out = buildPlanAdherence({
      templates: [],
      habitIds: ["a", "b"],
      habitLogs: [
        log("a", "2026-10-05"),
        log("a", "2026-10-05"),
        log("a", "2026-10-06"),
        log("b", "2026-10-06", false),
        log("supplement", "2026-10-06"),
      ],
    });
    // 2 ticked habit-days of 14.
    expect(out.habitCompletionPct).toBe(14);
    expect(out.zone2TargetMinutes).toBeNull();
  });
});

describe("weekly score with plan adherence", () => {
  const summary = buildWeeklyReviewSummary({
    bodyMetrics: [],
    cardioSessions: [],
    recoveryCheckins: [],
    liftsCompleted: 2,
    adherence: {
      liftsScheduled: 2,
      cardioScheduled: 2,
      zone2TargetMinutes: 100,
      habitCompletionPct: 50,
    },
  });

  it("measures lifts and Z2 against the scheduled templates", () => {
    const { scoreDetails } = calculateWeeklyReviewScore({
      summary,
      confidence: null,
    });
    const lifts = scoreDetails.components.find((c) => c.key === "lifts");
    const zone2 = scoreDetails.components.find((c) => c.key === "zone2");
    expect(lifts?.score).toBe(25);
    expect(lifts?.detail).toBe("2/2 target lifts logged");
    expect(zone2?.detail).toBe("0 / 100 target Zone 2 minutes");
  });

  it("falls back to 3 lifts, 3 rides and the plan's Z2 target without adherence", () => {
    const { scoreDetails } = calculateWeeklyReviewScore({
      summary: { liftsCompleted: 2 },
      confidence: null,
    });
    expect(scoreDetails.components.find((c) => c.key === "lifts")?.detail).toBe(
      "2/3 target lifts logged",
    );
  });

  it("round-trips the adherence fields of a stored summary", () => {
    expect(pickPlanAdherence(summary)).toEqual({
      liftsScheduled: 2,
      cardioScheduled: 2,
      zone2TargetMinutes: 100,
      habitCompletionPct: 50,
    });
  });
});
