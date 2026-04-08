import { describe, expect, it } from "vitest";
import {
  buildBodyMetricSummary,
  buildBodyWaistTrend,
  buildBodyWeightTrend,
  createBodyMetricSchema,
  updateBodyMetricSchema,
} from "../../index";
import type { BodyMetric } from "@fitness-app/domain";

const userId = "11111111-1111-4111-8111-111111111111";

describe("body metric validation", () => {
  it("accepts manual source by default", () => {
    const parsed = createBodyMetricSchema.parse({
      userId,
      measuredOn: "2026-03-31",
      weightLb: 189.2,
      waistIn: 34.1,
    });

    expect(parsed.source.sourceType).toBe("manual");
  });

  it("rejects negative weight changes on update input formatting", () => {
    expect(() =>
      updateBodyMetricSchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
        userId,
        weightLb: -1,
      }),
    ).toThrow();
  });
});

describe("body metric helpers", () => {
  const metrics: BodyMetric[] = [
    {
      id: "metric-1",
      userId,
      measuredOn: "2026-03-08",
      weightLb: 191.6,
      weightKg: null,
      waistIn: 35,
      waistCm: null,
      bodyFatPct: null,
      muscleMassLb: null,
      muscleMassKg: null,
      boneMassKg: null,
      boneMassLb: null,
      fatFreeMassKg: null,
      fatFreeMassLb: null,
      hydrationPct: null,
      visceralFatIndex: null,
      notes: null,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "metric-2",
      userId,
      measuredOn: "2026-03-29",
      weightLb: 189.4,
      weightKg: null,
      waistIn: 34.3,
      waistCm: null,
      bodyFatPct: 23.5,
      muscleMassLb: 144.3,
      muscleMassKg: null,
      boneMassKg: null,
      boneMassLb: null,
      fatFreeMassKg: null,
      fatFreeMassLb: null,
      hydrationPct: null,
      visceralFatIndex: null,
      notes: null,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-29T00:00:00.000Z",
      updatedAt: "2026-03-29T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "metric-3",
      userId,
      measuredOn: "2026-03-30",
      weightLb: null,
      weightKg: null,
      waistIn: null,
      waistCm: null,
      bodyFatPct: null,
      muscleMassLb: null,
      muscleMassKg: null,
      boneMassKg: null,
      boneMassLb: null,
      fatFreeMassKg: null,
      fatFreeMassLb: null,
      hydrationPct: null,
      visceralFatIndex: null,
      notes: null,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-30T00:00:00.000Z",
      updatedAt: "2026-03-30T00:00:00.000Z",
      deletedAt: null,
    },
  ];

  it("builds summary from the latest record with comparable deltas", () => {
    expect(buildBodyMetricSummary(metrics)).toEqual({
      latestWeightLb: 189.4,
      weightChangeLb: -2.2,
      latestWaistIn: 34.3,
      waistChangeIn: -0.7,
      latestBodyFatPct: 23.5,
      latestMuscleMassLb: 144.3,
      latestBoneMassLb: null,
      latestFatFreeMassLb: null,
      latestHydrationPct: null,
      latestVisceralFatIndex: null,
      latestSource: "manual",
    });
  });

  it("builds sparse trends that skip missing values", () => {
    expect(buildBodyWeightTrend(metrics)).toEqual([
      { date: "2026-03-08", value: 191.6 },
      { date: "2026-03-29", value: 189.4 },
    ]);
    expect(buildBodyWaistTrend(metrics)).toEqual([
      { date: "2026-03-08", value: 35 },
      { date: "2026-03-29", value: 34.3 },
    ]);
  });
});
