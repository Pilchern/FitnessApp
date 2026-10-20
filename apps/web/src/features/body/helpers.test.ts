import { describe, expect, it } from "vitest";
import type { BodyMetric } from "@fitness-app/domain";
import {
  bodyScanUpdateError,
  canEditBodyScan,
  formatBodyScanHint,
  toBodyFormValues,
  toBodyScanFields,
} from "./helpers";

function metric(overrides: Partial<BodyMetric> = {}): BodyMetric {
  return {
    id: "metric-1",
    userId: "user-1",
    measuredOn: "2026-10-24",
    weightLb: null,
    weightKg: null,
    waistIn: null,
    waistCm: null,
    waistHipIn: null,
    waistGutIn: null,
    bodyFatPct: 19.2,
    muscleMassLb: null,
    muscleMassKg: null,
    boneMassKg: null,
    boneMassLb: null,
    fatFreeMassKg: 65.68,
    fatFreeMassLb: 144.8,
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
    createdAt: "2026-10-24T15:00:00.000Z",
    updatedAt: "2026-10-24T15:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

const withingsSource: BodyMetric["source"] = {
  sourceType: "imported",
  sourceProvider: "withings",
  sourceExternalId: "w-1",
  importBatchId: null,
  rawImportEventId: null,
};

describe("toBodyScanFields", () => {
  it("stores lean mass as fat-free mass in lb and kg, never weight", () => {
    const fields = toBodyScanFields({ bodyFatPct: 19.2, leanMassLb: 144.8 });

    expect(fields).toEqual({
      bodyFatPct: 19.2,
      fatFreeMassLb: 144.8,
      fatFreeMassKg: 65.68,
    });
    expect(fields).not.toHaveProperty("weightLb");
    expect(fields).not.toHaveProperty("weightKg");
  });

  it("clears both units when lean mass is blank", () => {
    expect(toBodyScanFields({ bodyFatPct: null, leanMassLb: null })).toEqual({
      bodyFatPct: null,
      fatFreeMassLb: null,
      fatFreeMassKg: null,
    });
  });
});

describe("DEXA fields on the body form", () => {
  it("offers them for a new entry and for manual rows only", () => {
    expect(canEditBodyScan(null)).toBe(true);
    expect(canEditBodyScan(metric())).toBe(true);
    expect(canEditBodyScan(metric({ source: withingsSource }))).toBe(false);
  });

  it("prefills a manual DEXA row's values for editing", () => {
    const values = toBodyFormValues(metric());
    expect(values.bodyFatPct).toBe("19.2");
    expect(values.leanMassLb).toBe("144.8");
  });

  it("does not carry a Withings row's body composition into the form", () => {
    const values = toBodyFormValues(
      metric({ source: withingsSource, weightLb: 177.6, bodyFatPct: 21.1 }),
    );
    expect(values.bodyFatPct).toBe("");
    expect(values.leanMassLb).toBe("");
  });
});

describe("bodyScanUpdateError (server guard on update)", () => {
  it("allows DEXA fields on an existing manual row", () => {
    expect(bodyScanUpdateError(metric())).toBeNull();
  });

  it("refuses DEXA fields on a Withings row", () => {
    expect(
      bodyScanUpdateError(metric({ source: withingsSource, weightLb: 177.6 })),
    ).toMatch(/only be saved on a manual entry/);
  });

  it("refuses when the row cannot be found", () => {
    expect(bodyScanUpdateError(null)).toMatch(/could not be found/);
  });
});

describe("formatBodyScanHint", () => {
  it("shows the scan date and fat-free mass", () => {
    expect(
      formatBodyScanHint({
        measuredOn: "2026-10-24",
        bodyFatPct: 19.2,
        fatFreeMassLb: 144.8,
      }),
    ).toBe("Oct 24, 2026 · fat-free 144.8 lb");
  });

  it("shows only the date when lean mass is missing", () => {
    expect(
      formatBodyScanHint({
        measuredOn: "2026-10-24",
        bodyFatPct: 19.2,
        fatFreeMassLb: null,
      }),
    ).toBe("Oct 24, 2026");
  });
});
