import { describe, expect, it } from "vitest";
import {
  ageOn,
  buildPeerFitness,
  restingHeartRatePercentile,
  vo2MaxAtPercentile,
  vo2MaxPercentile,
} from "../../index";

describe("ageOn", () => {
  it("counts a birthday only once it has passed", () => {
    expect(ageOn("1990-10-14", "2026-10-13")).toBe(35);
    expect(ageOn("1990-10-13", "2026-10-13")).toBe(36);
  });
});

describe("vo2MaxPercentile (FRIEND 2022 treadmill)", () => {
  it("reads a table value exactly and interpolates between rows", () => {
    // Men 30-39: 50th = 39.7, 60th = 43.4.
    expect(vo2MaxPercentile(43.4, 35, "male")).toEqual({
      percentile: 60,
      beyond: null,
    });
    expect(vo2MaxPercentile(40, 35, "male")).toEqual({
      percentile: 51,
      beyond: null,
    });
  });

  it("flags values off either end of the table", () => {
    expect(vo2MaxPercentile(60, 35, "male")).toEqual({
      percentile: 90,
      beyond: "above",
    });
    expect(vo2MaxPercentile(20, 35, "male")).toEqual({
      percentile: 10,
      beyond: "below",
    });
  });

  it("uses the sex and decade rows", () => {
    expect(vo2MaxAtPercentile(90, 45, "female")).toBe(37.8);
    expect(vo2MaxAtPercentile(50, 92, "male")).toBe(17.6);
  });
});

describe("restingHeartRatePercentile (Quer 2020)", () => {
  it("centers men at 65 bpm and ranks lower as better", () => {
    expect(restingHeartRatePercentile(65, "male").percentile).toBe(50);
    expect(restingHeartRatePercentile(55, "male").percentile).toBe(90);
    expect(restingHeartRatePercentile(80, "male").percentile).toBe(2);
  });
});

describe("buildPeerFitness", () => {
  const base = {
    today: "2026-10-13",
    birthDate: "1990-06-01",
    sex: "male" as const,
    vo2Max: null,
    restingHeartRates: [55, 58, 60, 62, 57, 59, 61],
  };

  it("asks for the profile fields it needs", () => {
    expect(
      buildPeerFitness({ ...base, birthDate: null, sex: "unspecified" }),
    ).toEqual({ status: "needsProfile", missing: ["birth date", "sex"] });
  });

  it("ranks resting HR and lists VO2 max as pending without a reading", () => {
    const result = buildPeerFitness(base);
    if (result.status !== "ready") throw new Error("expected ready");
    expect(result.age).toBe(36);
    expect(result.ageBand).toBe("30-39");
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0]).toMatchObject({
      key: "restingHeartRate",
      value: 59,
      summary: "Better than 78% of men",
    });
    expect(result.pending.map((p) => p.key)).toEqual(["vo2Max"]);
  });

  it("ranks VO2 max with the next band to aim for", () => {
    const result = buildPeerFitness({
      ...base,
      vo2Max: { value: 40, date: "2026-10-12" },
    });
    if (result.status !== "ready") throw new Error("expected ready");
    expect(result.markers[0]).toMatchObject({
      key: "vo2Max",
      summary: "Better than 51% of men 30-39",
      next: "46.4 for the 70th percentile",
    });
  });

  it("waits for a week of resting HR", () => {
    const result = buildPeerFitness({ ...base, restingHeartRates: [60, 61] });
    if (result.status !== "ready") throw new Error("expected ready");
    expect(result.pending.find((p) => p.key === "restingHeartRate")?.hint).toBe(
      "Needs 7 days of synced resting heart rate; 2 so far.",
    );
  });
});
