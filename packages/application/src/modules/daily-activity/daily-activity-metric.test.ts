import { describe, expect, it } from "vitest";
import {
  createDailyActivityMetricSchema,
  updateDailyActivityMetricSchema,
} from "../../index";

const userId = "11111111-1111-4111-8111-111111111111";

describe("daily activity metric validation", () => {
  it("accepts manual source by default with all metric fields", () => {
    const parsed = createDailyActivityMetricSchema.parse({
      userId,
      metricDate: "2026-07-15",
      steps: 8123,
      vo2Max: 42.5,
      restingHeartRate: 54,
      exerciseMinutes: 35,
      activeEnergyKcal: 512.4,
    });

    expect(parsed.source.sourceType).toBe("manual");
    expect(parsed.steps).toBe(8123);
    expect(parsed.vo2Max).toBe(42.5);
    expect(parsed.restingHeartRate).toBe(54);
    expect(parsed.exerciseMinutes).toBe(35);
    expect(parsed.activeEnergyKcal).toBe(512.4);
  });

  it("accepts an imported source with all metric fields nullable", () => {
    const parsed = createDailyActivityMetricSchema.parse({
      userId,
      metricDate: "2026-07-15",
      steps: null,
      vo2Max: null,
      restingHeartRate: null,
      exerciseMinutes: null,
      activeEnergyKcal: null,
      source: {
        sourceType: "imported",
        sourceProvider: "apple_health",
        sourceExternalId: "2026-07-15",
      },
    });

    expect(parsed.source).toMatchObject({
      sourceType: "imported",
      sourceProvider: "apple_health",
    });
    expect(parsed.steps).toBeNull();
  });

  it("rejects an invalid metricDate format", () => {
    expect(() =>
      createDailyActivityMetricSchema.parse({
        userId,
        metricDate: "07/15/2026",
        steps: 100,
      }),
    ).toThrow();
  });

  it("rejects negative steps", () => {
    expect(() =>
      createDailyActivityMetricSchema.parse({
        userId,
        metricDate: "2026-07-15",
        steps: -5,
      }),
    ).toThrow();
  });

  it("rejects a non-positive vo2Max", () => {
    expect(() =>
      createDailyActivityMetricSchema.parse({
        userId,
        metricDate: "2026-07-15",
        vo2Max: 0,
      }),
    ).toThrow();
  });

  it("rejects updates with no fields provided", () => {
    expect(() =>
      updateDailyActivityMetricSchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
        userId,
      }),
    ).toThrow();
  });

  it("accepts a partial update with a single field", () => {
    const parsed = updateDailyActivityMetricSchema.parse({
      id: "22222222-2222-4222-8222-222222222222",
      userId,
      steps: 9000,
    });

    expect(parsed.steps).toBe(9000);
  });
});
