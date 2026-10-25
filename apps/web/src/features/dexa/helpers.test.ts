import { describe, expect, it } from "vitest";
import { formatDexaDelta, formatNumber } from "./helpers";

describe("formatDexaDelta", () => {
  it("labels changes under 2 lb as within noise", () => {
    expect(
      formatDexaDelta({
        label: "Lean",
        unit: "lb",
        change: 1.7,
        withinNoise: true,
      }),
    ).toBe("+1.7 lb, within noise");
  });

  it("shows real changes plainly", () => {
    expect(
      formatDexaDelta({
        label: "Fat",
        unit: "lb",
        change: -2.5,
        withinNoise: false,
      }),
    ).toBe("-2.5 lb");
  });

  it("keeps two decimals for small lb values like VAT", () => {
    expect(
      formatDexaDelta({
        label: "VAT",
        unit: "lb",
        change: 0.04,
        withinNoise: false,
      }),
    ).toBe("+0.04 lb");
  });

  it("says no data when a side is missing", () => {
    expect(
      formatDexaDelta({
        label: "VAT",
        unit: "lb",
        change: null,
        withinNoise: false,
      }),
    ).toBe("no data");
  });
});

describe("formatNumber", () => {
  it("formats with a unit and a dash for null", () => {
    expect(formatNumber(8.04, 2)).toBe("8.04");
    expect(formatNumber(22.8, 1, "%")).toBe("22.8 %");
    expect(formatNumber(null)).toBe("–");
  });
});
