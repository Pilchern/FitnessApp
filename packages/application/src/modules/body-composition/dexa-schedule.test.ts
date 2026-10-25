import { describe, expect, it } from "vitest";
import { nextDexaScan, parseDexaDates } from "../../index";

const baseline = {
  scanDate: "2026-10-24",
  facility: "Live Lean Rx, Libertyville",
  machine: "GE Lunar Prodigy",
};
const planned = parseDexaDates("2027-01-16, 2027-04-16");

describe("parseDexaDates", () => {
  it("keeps valid ISO dates, sorted", () => {
    expect(parseDexaDates("2027-04-16,2027-01-16, junk, 2027-13-99")).toEqual([
      "2027-01-16",
      "2027-04-16",
    ]);
    expect(parseDexaDates(null)).toEqual([]);
  });
});

describe("nextDexaScan", () => {
  it("counts down to Jan 16, then shows Apr 16", () => {
    expect(
      nextDexaScan({
        plannedDates: planned,
        scans: [baseline],
        today: "2026-10-25",
      }),
    ).toEqual({
      date: "2027-01-16",
      daysAway: 83,
      following: "2027-04-16",
      basis: "planned",
      facility: "Live Lean Rx, Libertyville",
      machine: "GE Lunar Prodigy",
    });
  });

  it("scan day itself is 0 days away", () => {
    expect(
      nextDexaScan({
        plannedDates: planned,
        scans: [baseline],
        today: "2027-01-16",
      })?.daysAway,
    ).toBe(0);
  });

  it("after Jan 16 the next is Apr 16, then every 6 months", () => {
    const next = nextDexaScan({
      plannedDates: planned,
      scans: [baseline],
      today: "2027-01-17",
    });
    expect(next).toMatchObject({ date: "2027-04-16", following: "2027-10-16" });
  });

  it("past the listed dates: 6 months after the newest scan", () => {
    const next = nextDexaScan({
      plannedDates: planned,
      scans: [baseline, { ...baseline, scanDate: "2027-04-17" }],
      today: "2027-05-01",
    });
    expect(next).toMatchObject({
      date: "2027-10-17",
      basis: "every_6_months",
      following: "2028-04-17",
    });
  });

  it("is null with nothing to go on", () => {
    expect(
      nextDexaScan({ plannedDates: [], scans: [], today: "2026-10-25" }),
    ).toBeNull();
  });
});
