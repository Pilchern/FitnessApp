import { describe, expect, it } from "vitest";
import type { StrengthSession } from "@fitness-app/domain";
import {
  buildInsights,
  calibrationCheckDate,
  calorieCalibration,
  calorieCalibrationInsight,
  liftsFlat,
} from "../../index";

function shift(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const CHECK = "2026-11-21";

/** Daily weigh-ins: `earlier` for the window 3 weeks back, `recent` for the last week. */
function weights(earlier: number, recent: number) {
  const rows = [];
  for (let i = 1; i <= 7; i += 1) {
    rows.push({ measuredOn: shift(CHECK, -i), weightLb: recent });
    rows.push({ measuredOn: shift(CHECK, -21 - i), weightLb: earlier });
  }
  return rows.map((r) => ({
    ...r,
    source: {
      sourceType: "imported" as const,
      sourceProvider: "withings",
      sourceExternalId: r.measuredOn,
      importBatchId: null,
      rawImportEventId: null,
    },
  }));
}

function kcal(days: number, calories = 2450) {
  return Array.from({ length: days }, (_, i) => ({
    logDate: shift(CHECK, -1 - i),
    calories,
  }));
}

function lift(sessionDate: string, weight: number) {
  return {
    sessionDate,
    sets: [
      {
        exerciseName: "Goblet Box Squat",
        weight,
        isWarmup: false,
      },
    ],
  } as unknown as Pick<StrengthSession, "sessionDate" | "sets">;
}

const flatLifts = [lift(shift(CHECK, -18), 50), lift(shift(CHECK, -3), 50)];
const risingLifts = [lift(shift(CHECK, -18), 50), lift(shift(CHECK, -3), 55)];

describe("calibrationCheckDate", () => {
  it("starts 2026-11-14 and steps weekly", () => {
    expect(calibrationCheckDate("2026-11-13")).toBeNull();
    expect(calibrationCheckDate("2026-11-14")).toBe("2026-11-14");
    expect(calibrationCheckDate("2026-11-20")).toBe("2026-11-14");
    expect(calibrationCheckDate("2026-11-21")).toBe("2026-11-21");
  });
});

describe("calorieCalibration", () => {
  const run = (
    w: ReturnType<typeof weights>,
    logs = kcal(7),
    sessions = flatLifts,
  ) =>
    calorieCalibration({
      today: "2026-11-23",
      bodyMetrics: w,
      nutritionLogs: logs,
      strengthSessions: sessions,
    });

  it("losing more than 0.5 lb/wk: raise 150-200", () => {
    const r = run(weights(180, 178));
    expect(r).toMatchObject({
      checkDate: CHECK,
      call: "raise",
      trendLbPerWeek: -0.67,
      avgKcal: 2450,
    });
  });

  it("gaining more than 0.25 lb/wk with flat lifts: cut 150", () => {
    expect(run(weights(178, 179.2))?.call).toBe("cut");
  });

  it("gaining more than 0.25 lb/wk while lifts go up: hold", () => {
    const r = run(weights(178, 179.2), kcal(7), risingLifts);
    expect(r?.call).toBe("hold");
    expect(r?.reason).toMatch(/lifts are going up/);
  });

  it("within -0.5 to +0.25 lb/wk: hold", () => {
    expect(run(weights(178, 178.5))?.call).toBe("hold");
  });

  it("exactly -0.5 lb/wk is not 'more than', so hold", () => {
    expect(run(weights(180, 178.5))?.call).toBe("hold");
  });

  it("fewer than 5 of the last 7 days logged: skipped, and says so", () => {
    const r = run(weights(180, 178), kcal(4));
    expect(r?.call).toBe("skipped");
    expect(r?.reason).toBe(
      "Only 4 of the last 7 days were logged in Cronometer; the check needs 5.",
    );
    const insight = calorieCalibrationInsight(r);
    expect(insight).toMatchObject({
      insightType: "calorie_calibration",
      insightDate: CHECK,
      title: "Calorie check skipped",
    });
  });

  it("skips when the weigh-ins cannot show a 3-week trend", () => {
    const r = run(weights(180, 178).slice(0, 4));
    expect(r?.call).toBe("skipped");
    expect(r?.reason).toMatch(/Too few Withings weigh-ins/);
  });

  it("is null before 2026-11-14", () => {
    expect(
      calorieCalibration({
        today: "2026-11-01",
        bodyMetrics: [],
        nutritionLogs: [],
        strengthSessions: [],
      }),
    ).toBeNull();
  });
});

describe("liftsFlat", () => {
  it("is null with no exercise in both weeks", () => {
    expect(liftsFlat([lift(shift(CHECK, -3), 50)], CHECK)).toBeNull();
  });
});

describe("buildInsights", () => {
  it("adds the weekly calibration when nutrition logs are passed", () => {
    const insights = buildInsights({
      bodyMetrics: weights(180, 178) as never,
      cardioSessions: [],
      recoveryCheckins: [],
      weeklyReviews: [],
      strengthSessions: [],
      liftsCompletedByWeek: {},
      nutritionLogs: kcal(7),
      now: new Date("2026-11-23T15:00:00Z"),
      timezone: "America/Chicago",
    });
    const calibration = insights.find(
      (i) => i.insightType === "calorie_calibration",
    );
    expect(calibration?.title).toBe("Calories: raise 150-200 kcal");
  });
});
