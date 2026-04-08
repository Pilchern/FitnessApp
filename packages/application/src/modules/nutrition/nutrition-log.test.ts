import { describe, expect, it } from "vitest";
import {
  buildNutritionAdherenceSummary,
  createNutritionLogSchema,
} from "../../index";
import type { NutritionLog } from "@fitness-app/domain";

const userId = "11111111-1111-4111-8111-111111111111";

describe("nutrition log validation", () => {
  it("createNutritionLogSchema accepts valid log with defaults", () => {
    const parsed = createNutritionLogSchema.parse({
      userId,
      logDate: "2026-04-01",
      proteinHit: true,
      mealsOnPlan: true,
    });

    expect(parsed.userId).toBe(userId);
    expect(parsed.logDate).toBe("2026-04-01");
    expect(parsed.proteinHit).toBe(true);
    expect(parsed.mealsOnPlan).toBe(true);
    expect(parsed.alcoholCount).toBe(0);
  });

  it("createNutritionLogSchema rejects negative alcoholCount", () => {
    expect(() =>
      createNutritionLogSchema.parse({
        userId,
        logDate: "2026-04-01",
        alcoholCount: -1,
      }),
    ).toThrow();
  });
});

describe("buildNutritionAdherenceSummary", () => {
  const logs: NutritionLog[] = [
    {
      id: "log-1",
      userId,
      logDate: "2026-04-01",
      proteinHit: true,
      mealsOnPlan: true,
      noPostDinnerSnacking: true,
      junkLeakage: false,
      fiberTaken: true,
      alcoholCount: 0,
      notes: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "log-2",
      userId,
      logDate: "2026-04-02",
      proteinHit: false,
      mealsOnPlan: true,
      noPostDinnerSnacking: false,
      junkLeakage: true,
      fiberTaken: false,
      alcoholCount: 2,
      notes: null,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
      deletedAt: null,
    },
  ];

  it("calculates correct adherence % from mixed data", () => {
    const summary = buildNutritionAdherenceSummary(logs);

    expect(summary.totalDays).toBe(2);
    expect(summary.proteinHitDays).toBe(1);
    expect(summary.mealsOnPlanDays).toBe(2);
    expect(summary.noPostDinnerSnackingDays).toBe(1);
    // junkLeakage=false means "no junk leakage" which is a hit
    expect(summary.noJunkLeakageDays).toBe(1);
    expect(summary.fiberTakenDays).toBe(1);
    expect(summary.totalAlcohol).toBe(2);

    // proteinHit: 1/2=50%, mealsOnPlan: 2/2=100%, noPostDinnerSnacking: 1/2=50%,
    // noJunkLeakage: 1/2=50%, fiberTaken: 1/2=50%
    // average = (50+100+50+50+50)/5 = 300/5 = 60%
    expect(summary.adherencePct).toBe(60);
  });

  it("handles all-null boolean fields", () => {
    const nullLogs: NutritionLog[] = [
      {
        id: "log-3",
        userId,
        logDate: "2026-04-03",
        proteinHit: null,
        mealsOnPlan: null,
        noPostDinnerSnacking: null,
        junkLeakage: null,
        fiberTaken: null,
        alcoholCount: 1,
        notes: null,
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
        deletedAt: null,
      },
    ];

    const summary = buildNutritionAdherenceSummary(nullLogs);

    expect(summary.totalDays).toBe(1);
    expect(summary.totalAlcohol).toBe(1);
    expect(summary.adherencePct).toBe(0);
  });
});
