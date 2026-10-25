import { describe, expect, it } from "vitest";
import type { BodyMetric } from "@fitness-app/domain";
import {
  dexaAdjustedBodyFat,
  dexaCalibrations,
  withingsBodyFatAverage,
} from "../../index";

type Row = Pick<BodyMetric, "measuredOn" | "bodyFatPct" | "source">;

const withings = (measuredOn: string, bodyFatPct: number | null): Row => ({
  measuredOn,
  bodyFatPct,
  source: {
    sourceType: "imported",
    sourceProvider: "withings",
    sourceExternalId: `w-${measuredOn}`,
    importBatchId: null,
    rawImportEventId: null,
  },
});

const manual = (measuredOn: string, bodyFatPct: number): Row => ({
  measuredOn,
  bodyFatPct,
  source: {
    sourceType: "manual",
    sourceProvider: null,
    sourceExternalId: null,
    importBatchId: null,
    rawImportEventId: null,
  },
});

// Three weigh-ins in the week ending scan day, averaging 21.2%.
const scale = [
  withings("2026-10-16", 30), // outside the window
  withings("2026-10-18", 21.0),
  withings("2026-10-21", 21.3),
  withings("2026-10-23", 21.3),
  manual("2026-10-22", 10), // tape row, never counted
  withings("2026-10-24", null),
];

describe("withingsBodyFatAverage", () => {
  it("averages scale rows in the 7 days ending the date", () => {
    expect(withingsBodyFatAverage(scale, "2026-10-24")).toEqual({
      avg: 21.2,
      readings: 3,
      start: "2026-10-18",
      end: "2026-10-24",
    });
  });

  it("is null without readings", () => {
    expect(withingsBodyFatAverage(scale, "2026-12-01")).toBeNull();
  });
});

describe("dexaCalibrations", () => {
  it("baseline offset is DEXA 22.8 minus the Withings average: +1.6", () => {
    const [row] = dexaCalibrations(
      [{ scanDate: "2026-10-24", bodyFatPct: 22.8 }],
      scale,
    );
    expect(row).toEqual({
      scanDate: "2026-10-24",
      dexaBodyFatPct: 22.8,
      withingsAvgPct: 21.2,
      withingsReadings: 3,
      offsetPct: 1.6,
    });
  });

  it("leaves the offset null when the scale has no readings that week", () => {
    const [row] = dexaCalibrations(
      [{ scanDate: "2026-12-01", bodyFatPct: 21 }],
      scale,
    );
    expect(row?.offsetPct).toBeNull();
  });
});

describe("dexaAdjustedBodyFat", () => {
  it("adds the newest offset to the current Withings average", () => {
    const later = [
      ...scale,
      withings("2026-11-10", 20.4),
      withings("2026-11-12", 20.6),
    ];
    const cal = dexaCalibrations(
      [{ scanDate: "2026-10-24", bodyFatPct: 22.8 }],
      later,
    );
    expect(dexaAdjustedBodyFat(cal, later, "2026-11-13")).toEqual({
      withingsAvgPct: 20.5,
      withingsReadings: 2,
      offsetPct: 1.6,
      offsetScanDate: "2026-10-24",
      estimatePct: 22.1,
    });
  });

  it("does not modify the scale rows", () => {
    const rows = [withings("2026-10-24", 21.2)];
    const cal = dexaCalibrations(
      [{ scanDate: "2026-10-24", bodyFatPct: 22.8 }],
      rows,
    );
    dexaAdjustedBodyFat(cal, rows, "2026-10-24");
    expect(rows[0]?.bodyFatPct).toBe(21.2);
  });

  it("is null with no calibrated scan", () => {
    expect(dexaAdjustedBodyFat([], scale, "2026-10-24")).toBeNull();
  });
});
