import { describe, expect, it } from "vitest";
import { DEFAULT_PROGRAM_SETTINGS, dexaTargetProgress } from "../../index";
import { baselineScan } from "./dexa-fixtures.test-helpers";

const none = {
  quadLsiFirst: null,
  quadLsiLatest: null,
  waistFirst: null,
  waistLatest: null,
};

function byKey(rows: ReturnType<typeof dexaTargetProgress>) {
  return Object.fromEntries(rows.map((r) => [r.key, r]));
}

describe("dexaTargetProgress", () => {
  it("baseline only: current = baseline, 0% toward the first target", () => {
    const rows = byKey(
      dexaTargetProgress({
        scans: [baselineScan()],
        profileHeightCm: 183,
        settings: DEFAULT_PROGRAM_SETTINGS,
        ...none,
      }),
    );
    expect(rows.almi).toMatchObject({
      current: 8.04,
      baseline: 8.04,
      next: { label: "Jan 2027", value: 8.25, met: false },
      progressPct: 0,
    });
    expect(rows.leg_lean_lsi).toMatchObject({ current: 90.1, progressPct: 0 });
    expect(rows.dexa_bf).toMatchObject({
      current: 22.8,
      next: { value: 21.5 },
    });
    // VAT 0.09 is under the 0.25 ceiling.
    expect(rows.vat).toMatchObject({ current: 0.09, next: null });
    expect(rows.vat?.targets[0]?.met).toBe(true);
  });

  it("measures the share of the way from baseline to the next target", () => {
    const jan = baselineScan({
      id: "s2",
      scanDate: "2027-01-16",
      legsLeanLb: 41.6,
      leftLegLeanLb: 20.0,
      bodyFatPct: 21.5,
    });
    const rows = byKey(
      dexaTargetProgress({
        scans: [jan, baselineScan()],
        profileHeightCm: null,
        settings: DEFAULT_PROGRAM_SETTINGS,
        ...none,
      }),
    );
    // ALMI (19.0 + 41.6 lb) -> 8.22: 18 of 21 hundredths to 8.25.
    expect(rows.almi?.current).toBe(8.22);
    expect(rows.almi?.progressPct).toBe(86);
    // 21.5% meets Jan 2027; next is Oct 2027 at 17.5.
    expect(rows.dexa_bf?.targets[0]?.met).toBe(true);
    expect(rows.dexa_bf?.next?.value).toBe(17.5);
    expect(rows.dexa_bf?.progressPct).toBe(25);
  });

  it("quad LSI and waist show no data until readings exist", () => {
    const rows = byKey(
      dexaTargetProgress({
        scans: [],
        profileHeightCm: null,
        settings: DEFAULT_PROGRAM_SETTINGS,
        ...none,
      }),
    );
    expect(rows.quad_lsi).toMatchObject({ current: null, next: null });
    expect(rows.waist).toMatchObject({ current: null, next: null });
    expect(rows.almi?.current).toBeNull();
  });

  it("uses the RTS gate (lsiTarget3) for quad strength and the waist ceiling", () => {
    const rows = byKey(
      dexaTargetProgress({
        scans: [baselineScan()],
        profileHeightCm: null,
        settings: DEFAULT_PROGRAM_SETTINGS,
        quadLsiFirst: { date: "2026-10-20", value: 60 },
        quadLsiLatest: { date: "2026-11-20", value: 75 },
        waistFirst: { date: "2026-10-01", value: 35.5 },
        waistLatest: { date: "2026-11-01", value: 34.4 },
      }),
    );
    expect(rows.quad_lsi).toMatchObject({
      next: { value: 90 },
      progressPct: 50,
    });
    expect(rows.waist?.targets[0]?.met).toBe(true);
    expect(rows.waist?.next).toBeNull();
  });
});
