import { describe, expect, it } from "vitest";
import type { BodyMetric } from "@fitness-app/domain";
import { toBodyFormValues } from "./helpers";

function metric(overrides: Partial<BodyMetric> = {}): BodyMetric {
  return {
    id: "metric-1",
    userId: "user-1",
    measuredOn: "2026-10-24",
    weightLb: 177.6,
    weightKg: null,
    waistIn: 34.8,
    waistCm: null,
    waistHipIn: null,
    waistGutIn: null,
    bodyFatPct: 21.1,
    muscleMassLb: null,
    muscleMassKg: null,
    boneMassKg: null,
    boneMassLb: null,
    fatFreeMassKg: null,
    fatFreeMassLb: 140.6,
    hydrationPct: null,
    visceralFatIndex: null,
    notes: null,
    source: {
      sourceType: "imported",
      sourceProvider: "withings",
      sourceExternalId: "w-1",
      importBatchId: null,
      rawImportEventId: null,
    },
    createdAt: "2026-10-24T15:00:00.000Z",
    updatedAt: "2026-10-24T15:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("toBodyFormValues", () => {
  it("carries tape measurements only, never scale or DEXA composition", () => {
    const values = toBodyFormValues(metric());
    expect(values.waistIn).toBe("34.8");
    expect(values).not.toHaveProperty("bodyFatPct");
    expect(values).not.toHaveProperty("leanMassLb");
  });
});
