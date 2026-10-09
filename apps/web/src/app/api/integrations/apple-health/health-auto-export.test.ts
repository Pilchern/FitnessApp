import { describe, expect, it } from "vitest";
import {
  dedupeOverlappingRides,
  mapHealthAutoExport,
  toIsoDateTime,
} from "./health-auto-export";

// Synthetic values in Health Auto Export's REST shape (aggregated by day).
const metricsBody = {
  data: {
    metrics: [
      {
        name: "step_count",
        units: "count",
        data: [{ date: "2026-10-08 00:00:00 -0500", qty: 7210, source: "W" }],
      },
      {
        name: "resting_heart_rate",
        units: "count/min",
        data: [{ date: "2026-10-08 00:00:00 -0500", qty: 58 }],
      },
      {
        name: "heart_rate_variability",
        units: "ms",
        data: [{ date: "2026-10-08 00:00:00 -0500", qty: 44.5 }],
      },
      {
        name: "vo2_max",
        units: "ml/(kg·min)",
        data: [{ date: "2026-10-08 00:00:00 -0500", qty: 40.1 }],
      },
      {
        name: "apple_exercise_time",
        units: "min",
        data: [{ date: "2026-10-08 00:00:00 -0500", qty: 32 }],
      },
      {
        name: "active_energy",
        units: "kJ",
        data: [{ date: "2026-10-08 00:00:00 -0500", qty: 2092 }],
      },
      {
        name: "weight_body_mass",
        units: "lb",
        data: [{ date: "2026-10-08 00:00:00 -0500", qty: 180, source: "W" }],
      },
      {
        name: "sleep_analysis",
        units: "hr",
        data: [
          {
            date: "2026-10-08 00:00:00 -0500",
            totalSleep: 7.5,
            asleep: 0,
            core: 4.5,
            deep: 1,
            rem: 2,
            awake: 0.25,
            inBed: 0,
            inBedStart: "2026-10-07 21:45:00 -0500",
            inBedEnd: "2026-10-08 05:45:00 -0500",
          },
        ],
      },
    ],
  },
};

describe("mapHealthAutoExport metrics", () => {
  const mapped = mapHealthAutoExport(metricsBody);

  it("maps daily activity and converts kJ to kcal", () => {
    expect(mapped.dailyMetrics).toEqual([
      {
        date: "2026-10-08",
        steps: 7210,
        resting_heart_rate: 58,
        vo2_max: 40.1,
        exercise_minutes: 32,
        active_energy_kcal: 500,
      },
    ]);
  });

  it("maps sleep stages from hours, time in bed from the bed window, and HRV and resting HR", () => {
    expect(mapped.sleep).toEqual([
      {
        date: "2026-10-08",
        resting_heart_rate: 58,
        hrv: 44.5,
        sleep_duration_minutes: 450,
        deep_sleep_minutes: 60,
        rem_sleep_minutes: 120,
        core_sleep_minutes: 270,
        awake_minutes: 15,
        time_in_bed_minutes: 480,
      },
    ]);
  });

  it("ignores weight (Withings is the direct source)", () => {
    expect(JSON.stringify(mapped)).not.toContain("180");
  });

  it("accepts the older vo2max name and a plain date", () => {
    const out = mapHealthAutoExport({
      data: {
        metrics: [
          { name: "vo2max", data: [{ date: "2026-10-01", qty: 39.7 }] },
        ],
      },
    });
    expect(out.dailyMetrics).toEqual([{ date: "2026-10-01", vo2_max: 39.7 }]);
  });
});

describe("mapHealthAutoExport workouts", () => {
  const ride = {
    id: "A1",
    name: "Indoor Cycling",
    start: "2026-10-08 19:00:00 -0500",
    end: "2026-10-08 19:30:00 -0500",
    duration: 1800,
    avgHeartRate: { qty: 118, units: "bpm" },
    maxHeartRate: { qty: 131, units: "bpm" },
    distance: { qty: 10, units: "km" },
  };

  it("keeps rides as Zone 2 and converts units", () => {
    const out = mapHealthAutoExport({ data: { workouts: [ride] } });
    expect(out.workouts).toEqual([
      {
        workout_id: "A1",
        workout_type: "Indoor Cycling",
        session_kind: "zone2",
        start: "2026-10-08T19:00:00-05:00",
        end: "2026-10-08T19:30:00-05:00",
        duration_minutes: 30,
        avg_heart_rate: 118,
        max_heart_rate: 131,
        distance_meters: 10000,
        source_name: "Health Auto Export",
      },
    ]);
  });

  it("drops walks and strength workouts", () => {
    const out = mapHealthAutoExport({
      data: {
        workouts: [
          { ...ride, id: "W", name: "Outdoor Walk" },
          { ...ride, id: "S", name: "Traditional Strength Training" },
        ],
      },
    });
    expect(out.workouts).toEqual([]);
  });

  it("reads v2 nested heart rate and builds an id for v1 exports", () => {
    const out = mapHealthAutoExport({
      data: {
        workouts: [
          {
            name: "Cycling",
            start: "2026-10-08 19:00:00 -0500",
            end: "2026-10-08 19:45:00 -0500",
            heartRate: { avg: { qty: 120 }, max: { qty: 140 } },
          },
        ],
      },
    });
    expect(out.workouts[0]?.workout_id).toBe(
      "hae:Cycling:2026-10-08T19:00:00-05:00",
    );
    expect(out.workouts[0]?.avg_heart_rate).toBe(120);
  });

  it("keeps one of two overlapping rides, preferring the one with heart rate", () => {
    const watch = { ...ride, id: "WATCH" };
    const peloton = {
      ...ride,
      id: "PELO",
      start: "2026-10-08 19:01:00 -0500",
      avgHeartRate: undefined,
      maxHeartRate: undefined,
    };
    const out = mapHealthAutoExport({ data: { workouts: [peloton, watch] } });
    expect(out.workouts.map((w) => w.workout_id)).toEqual(["WATCH"]);
  });

  it("keeps back-to-back rides that do not overlap", () => {
    const later = {
      ...ride,
      id: "B2",
      start: "2026-10-08 19:30:00 -0500",
      end: "2026-10-08 20:00:00 -0500",
    };
    expect(
      dedupeOverlappingRides(
        mapHealthAutoExport({ data: { workouts: [ride, later] } }).workouts,
      ),
    ).toHaveLength(2);
  });
});

describe("toIsoDateTime", () => {
  it("normalizes Health Auto Export timestamps", () => {
    expect(toIsoDateTime("2026-08-10 17:08:29 +0200")).toBe(
      "2026-08-10T17:08:29+02:00",
    );
    expect(toIsoDateTime("2026-08-10T17:08:29Z")).toBe("2026-08-10T17:08:29Z");
    expect(toIsoDateTime("nope")).toBeNull();
  });
});
