import { describe, expect, it } from "vitest";
import { DEXA_MEASUREMENT_KEYS } from "@fitness-app/domain";
import { baselineScan } from "./dexa-fixtures.test-helpers";
import {
  almi,
  compareDexaScans,
  DEXA_FIELDS,
  dexaDeltas,
  dexaDerived,
  ffmi,
  limbLsi,
  saveDexaScanSchema,
} from "../../index";

describe("DEXA derived metrics, baseline 2026-10-24", () => {
  const scan = baselineScan();

  it("ALMI = (arms + legs lean, kg) / height m² = 8.04", () => {
    expect(almi(scan)).toBe(8.04);
  });

  it("FFMI = (lean + BMC, kg) / height m² = 19.3", () => {
    expect(ffmi(scan)).toBe(19.3);
  });

  it("leg lean LSI = left / right x 100 = 90.1", () => {
    expect(limbLsi(scan.leftLegLeanLb, scan.rightLegLeanLb)).toBe(90.1);
  });

  it("arm lean LSI = 94.9", () => {
    expect(dexaDerived(scan).armLeanLsi).toBe(94.9);
  });

  it("falls back to the profile height when the scan has none", () => {
    // 183.0 cm is 72.05 in, so ALMI rounds to 8.03.
    expect(almi(baselineScan({ heightIn: null }), 183)).toBe(8.03);
    expect(almi(baselineScan({ heightIn: null }), null)).toBeNull();
  });

  it("returns null when an input is missing", () => {
    expect(ffmi(baselineScan({ bmcLb: null }))).toBeNull();
    expect(limbLsi(null, 21.2)).toBeNull();
    expect(limbLsi(19.1, 0)).toBeNull();
  });
});

describe("dexaDeltas", () => {
  it("labels lean and fat changes under 2.0 lb as noise", () => {
    const next = baselineScan({
      id: "scan-2",
      scanDate: "2027-01-16",
      leanLb: 136.9,
      fatLb: 39.6,
      leftLegLeanLb: 20.1,
      bodyFatPct: 21.6,
    });
    const byLabel = Object.fromEntries(
      dexaDeltas(baselineScan(), next).map((d) => [d.label, d]),
    );
    expect(byLabel["Lean"]).toMatchObject({ change: 1.7, withinNoise: true });
    expect(byLabel["Fat"]).toMatchObject({ change: -2.5, withinNoise: false });
    expect(byLabel["Left leg lean"]).toMatchObject({
      change: 1,
      withinNoise: true,
    });
    // Percent rows are never labelled noise by the lb rule.
    expect(byLabel["Body fat"]).toMatchObject({
      change: -1.2,
      withinNoise: false,
    });
  });

  it("exactly 2.0 lb is a change, not noise", () => {
    const next = baselineScan({ id: "scan-2", leanLb: 137.2 });
    const lean = dexaDeltas(baselineScan(), next).find(
      (d) => d.label === "Lean",
    );
    expect(lean).toMatchObject({ change: 2, withinNoise: false });
  });
});

describe("compareDexaScans", () => {
  it("one scan: no comparison", () => {
    const result = compareDexaScans([baselineScan()]);
    expect(result?.latestDerived.almi).toBe(8.04);
    expect(result?.previous).toBeNull();
    expect(result?.baseline).toBeNull();
  });

  it("three scans: vs previous and vs baseline", () => {
    const jan = baselineScan({ id: "s2", scanDate: "2027-01-16", leanLb: 137 });
    const apr = baselineScan({ id: "s3", scanDate: "2027-04-16", leanLb: 139 });
    const result = compareDexaScans([apr, baselineScan(), jan]);
    expect(result?.latest.id).toBe("s3");
    expect(result?.previous?.scan.id).toBe("s2");
    expect(result?.baseline?.scan.id).toBe("scan-1");
    expect(
      result?.baseline?.deltas.find((d) => d.label === "Lean")?.change,
    ).toBe(3.8);
  });

  it("two scans: the baseline is the previous scan, shown once", () => {
    const jan = baselineScan({ id: "s2", scanDate: "2027-01-16" });
    const result = compareDexaScans([baselineScan(), jan]);
    expect(result?.previous?.scan.id).toBe("scan-1");
    expect(result?.baseline).toBeNull();
  });
});

describe("saveDexaScanSchema", () => {
  it("has a field spec for every stored measurement", () => {
    expect(DEXA_FIELDS.map((f) => f.key).sort()).toEqual(
      [...DEXA_MEASUREMENT_KEYS].sort(),
    );
  });

  it("accepts the baseline and rejects out-of-range values", () => {
    const { id, createdAt, updatedAt, ...input } = baselineScan();
    void id;
    void createdAt;
    void updatedAt;
    expect(saveDexaScanSchema.parse(input).legsLeanLb).toBe(40.3);
    expect(() =>
      saveDexaScanSchema.parse({ ...input, bodyFatPct: 90 }),
    ).toThrow(/Body fat must be at most 80/);
  });
});
