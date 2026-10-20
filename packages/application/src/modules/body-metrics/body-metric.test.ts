import { describe, expect, it } from "vitest";
import {
  buildBodyFatTrend,
  buildBodyMetricSummary,
  buildBodyWaistTrend,
  buildBodyWeightTrend,
  buildWeeklyWeightTrend,
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

  it("rejects a weight that is obviously a data-entry error", () => {
    // This value directly feeds NutritionTargetService's calorie/protein
    // calculation, so a garbage weight would silently corrupt someone's
    // nutrition targets if it weren't caught here.
    expect(() =>
      createBodyMetricSchema.parse({
        userId,
        measuredOn: "2026-03-31",
        weightLb: 18900,
      }),
    ).toThrow();
  });

  it("rejects a waist measurement that is obviously a data-entry error", () => {
    expect(() =>
      createBodyMetricSchema.parse({
        userId,
        measuredOn: "2026-03-31",
        waistIn: 3410,
      }),
    ).toThrow();
  });

  it("accepts the hip and gut waist measurement points", () => {
    const parsed = createBodyMetricSchema.parse({
      userId,
      measuredOn: "2026-03-31",
      waistIn: 34.1,
      waistHipIn: 38.5,
      waistGutIn: 36.2,
    });

    expect(parsed.waistHipIn).toBe(38.5);
    expect(parsed.waistGutIn).toBe(36.2);
  });

  it("rejects non-positive hip/gut waist measurements", () => {
    expect(() =>
      createBodyMetricSchema.parse({
        userId,
        measuredOn: "2026-03-31",
        waistHipIn: 0,
      }),
    ).toThrow();

    expect(() =>
      createBodyMetricSchema.parse({
        userId,
        measuredOn: "2026-03-31",
        waistGutIn: -2,
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
      waistHipIn: null,
      waistGutIn: null,
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
      waistHipIn: null,
      waistGutIn: null,
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
      waistHipIn: null,
      waistGutIn: null,
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
      // Manual rows never feed the scale's body fat; see latestScan.
      latestBodyFatPct: null,
      latestMuscleMassLb: 144.3,
      latestBoneMassLb: null,
      latestFatFreeMassLb: null,
      latestHydrationPct: null,
      latestVisceralFatIndex: null,
      latestSource: "manual",
      latestScan: {
        measuredOn: "2026-03-29",
        bodyFatPct: 23.5,
        fatFreeMassLb: null,
      },
    });
  });

  const withings = (
    measuredOn: string,
    weightLb: number,
    fat: number,
  ): BodyMetric => ({
    ...metrics[2]!,
    id: `withings-${measuredOn}`,
    measuredOn,
    weightLb,
    bodyFatPct: fat,
    fatFreeMassLb: 140.6,
    source: {
      sourceType: "imported",
      sourceProvider: "withings",
      sourceExternalId: `w-${measuredOn}`,
      importBatchId: null,
      rawImportEventId: null,
    },
  });
  // Manual DEXA row: body fat and lean mass, no weight.
  const dexa: BodyMetric = {
    ...metrics[2]!,
    id: "dexa-1",
    measuredOn: "2026-10-24",
    bodyFatPct: 19.2,
    fatFreeMassLb: 144.8,
    fatFreeMassKg: 65.68,
  };

  it("keeps a DEXA entry visible after the scale syncs, without touching weight", () => {
    const summary = buildBodyMetricSummary([
      withings("2026-10-25", 178.2, 21.4),
      dexa,
      withings("2026-10-24", 177.6, 21.1),
    ]);

    expect(summary.latestScan).toEqual({
      measuredOn: "2026-10-24",
      bodyFatPct: 19.2,
      fatFreeMassLb: 144.8,
    });
    // The scale's own numbers are unchanged by the DEXA row.
    expect(summary.latestWeightLb).toBe(178.2);
    expect(summary.latestBodyFatPct).toBe(21.4);
    expect(summary.latestFatFreeMassLb).toBe(140.6);
  });

  it("keeps the dashboard/scale body fat on the scale when DEXA is the newest row", () => {
    // Dashboard "Body fat" and the /body scale cards read these two fields.
    const summary = buildBodyMetricSummary([
      { ...dexa, measuredOn: "2026-10-25" },
      withings("2026-10-24", 177.6, 21.1),
    ]);

    expect(summary.latestBodyFatPct).toBe(21.1);
    expect(summary.latestFatFreeMassLb).toBe(140.6);
    expect(summary.latestScan?.bodyFatPct).toBe(19.2);
  });

  it("plots only scale readings on the body-fat trend", () => {
    expect(
      buildBodyFatTrend([
        withings("2026-10-25", 178.2, 21.4),
        dexa,
        withings("2026-10-23", 177.4, 21.0),
      ]),
    ).toEqual([
      { date: "2026-10-23", value: 21.0 },
      { date: "2026-10-25", value: 21.4 },
    ]);
  });

  it("has no scan when only the scale reports body composition", () => {
    expect(
      buildBodyMetricSummary([
        {
          ...metrics[2]!,
          weightLb: 178,
          bodyFatPct: 21,
          source: {
            sourceType: "imported",
            sourceProvider: "withings",
            sourceExternalId: "w-1",
            importBatchId: null,
            rawImportEventId: null,
          },
        },
      ]).latestScan,
    ).toBeNull();
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

describe("buildWeeklyWeightTrend", () => {
  // 2026-10-11 is a Sunday; windows end 10-11, 10-04, 09-27.
  const w = (measuredOn: string, weightLb: number | null) => ({
    measuredOn,
    weightLb,
  });

  // Three weigh-ins at `lb` inside the window ending `end`.
  const three = (end: string, lb: number) => {
    const day = Number(end.slice(8));
    return [0, 2, 4].map((back) =>
      w(`${end.slice(0, 8)}${String(day - back).padStart(2, "0")}`, lb),
    );
  };

  it("averages the trailing 7 days and flags two weeks over +0.5", () => {
    const out = buildWeeklyWeightTrend(
      [
        ...three("2026-09-27", 180.0),
        ...three("2026-10-04", 180.6),
        ...three("2026-10-11", 181.2),
        w("2026-10-08", null),
      ],
      "2026-10-11",
    );
    expect(out).toEqual({
      sevenDayAvgLb: 181.2,
      weekOverWeekLb: 0.6,
      surplusThrottle: true,
    });
  });

  it("does not flag with fewer than 3 weigh-ins in any window", () => {
    const out = buildWeeklyWeightTrend(
      [
        w("2026-09-21", 179.8),
        w("2026-09-27", 180.2),
        ...three("2026-10-04", 180.6),
        ...three("2026-10-11", 181.2),
      ],
      "2026-10-11",
    );
    expect(out).toEqual({
      sevenDayAvgLb: 181.2,
      weekOverWeekLb: 0.6,
      surplusThrottle: false,
    });
  });

  it("does not flag when only one week is over, or a week is exactly 0.5", () => {
    expect(
      buildWeeklyWeightTrend(
        [
          ...three("2026-09-27", 180.0),
          ...three("2026-10-04", 180.3),
          ...three("2026-10-11", 181.0),
        ],
        "2026-10-11",
      ).surplusThrottle,
    ).toBe(false);
    expect(
      buildWeeklyWeightTrend(
        [
          ...three("2026-09-27", 180.0),
          ...three("2026-10-04", 180.5),
          ...three("2026-10-11", 181.0),
        ],
        "2026-10-11",
      ).surplusThrottle,
    ).toBe(false);
  });

  it("returns nulls and no flag without enough weigh-ins", () => {
    expect(
      buildWeeklyWeightTrend([w("2026-10-11", 181)], "2026-10-11"),
    ).toEqual({
      sevenDayAvgLb: 181,
      weekOverWeekLb: null,
      surplusThrottle: false,
    });
    expect(buildWeeklyWeightTrend([], "2026-10-11")).toEqual({
      sevenDayAvgLb: null,
      weekOverWeekLb: null,
      surplusThrottle: false,
    });
  });
});
