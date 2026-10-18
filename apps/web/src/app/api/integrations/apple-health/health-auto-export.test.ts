import { describe, expect, it } from "vitest";
import {
  dedupeOverlappingRides,
  mapHealthAutoExport,
  toIsoDateTime,
  toLocalClockTime,
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
            sleepStart: "2026-10-07 21:58:12 -0500",
            sleepEnd: "2026-10-08 05:41:40 -0500",
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
        bedtime_local: "21:58",
        wake_time_local: "05:41",
      },
    ]);
  });

  it("falls back to the in-bed window for bedtime and wake", () => {
    const out = mapHealthAutoExport({
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              {
                date: "2026-10-09 00:00:00 -0500",
                totalSleep: 7,
                inBedStart: "2026-10-08 21:30:00 -0500",
                inBedEnd: "2026-10-09 06:05:00 -0500",
              },
            ],
          },
        ],
      },
    });
    expect(out.sleep[0]).toMatchObject({
      bedtime_local: "21:30",
      wake_time_local: "06:05",
    });
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

describe("toLocalClockTime", () => {
  it("keeps the phone's wall-clock hour and minute", () => {
    expect(toLocalClockTime("2026-10-11 21:42:10 -0500")).toBe("21:42");
    expect(toLocalClockTime("2026-10-12T06:05:00Z")).toBe("06:05");
    expect(toLocalClockTime("2026-10-12")).toBeNull();
    expect(toLocalClockTime(undefined)).toBeNull();
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

describe("mapHealthAutoExport strength workouts", () => {
  const lift = {
    id: "L1",
    name: "Traditional Strength Training",
    start: "2026-10-12 17:30:00 -0500",
    end: "2026-10-12 18:22:00 -0500",
    duration: 3120,
    heartRate: { avg: { qty: 112.4 }, max: { qty: 151 } },
    activeEnergyBurned: { qty: 1400, units: "kJ" },
  };

  it("keeps Watch strength workouts apart from rides, on their local date", () => {
    const out = mapHealthAutoExport({ data: { workouts: [lift] } });
    expect(out.workouts).toEqual([]);
    expect(out.strengthWorkouts).toEqual([
      {
        externalId: "L1",
        workoutType: "Traditional Strength Training",
        localDate: "2026-10-12",
        startedAt: "2026-10-12T17:30:00-05:00",
        endedAt: "2026-10-12T18:22:00-05:00",
        durationMinutes: 52,
        avgHeartRate: 112,
        maxHeartRate: 151,
        activeEnergyKcal: 335,
      },
    ]);
  });

  it("drops an implausible heart rate rather than the workout", () => {
    const out = mapHealthAutoExport({
      data: {
        workouts: [{ ...lift, heartRate: { avg: { qty: 400 } } }],
      },
    });
    expect(out.strengthWorkouts[0]?.avgHeartRate).toBeNull();
    expect(out.strengthWorkouts[0]?.durationMinutes).toBe(52);
  });

  it("ignores walks", () => {
    const out = mapHealthAutoExport({
      data: { workouts: [{ ...lift, name: "Outdoor Walk" }] },
    });
    expect(out.strengthWorkouts).toEqual([]);
  });
});

describe("mapHealthAutoExport overnight (hourly) metrics", () => {
  const hourly = (hours: [string, number][]) =>
    hours.map(([date, qty]) => ({ date: `${date} -0500`, qty }));

  const body = {
    data: {
      metrics: [
        {
          name: "heart_rate_variability",
          units: "ms",
          data: hourly([
            ["2026-10-12 15:00:00", 30], // daytime: ignored
            ["2026-10-12 23:00:00", 60], // counts toward 10-13
            ["2026-10-13 02:00:00", 70],
            ["2026-10-13 05:00:00", 80],
            ["2026-10-13 07:00:00", 20], // after the window: ignored
          ]),
        },
        {
          name: "heart_rate",
          units: "count/min",
          data: [
            { date: "2026-10-13 01:00:00 -0500", Min: 48, Avg: 52, Max: 60 },
            { date: "2026-10-13 03:00:00 -0500", Min: 49, Avg: 55, Max: 63 },
            { date: "2026-10-13 12:00:00 -0500", Min: 70, Avg: 95, Max: 130 },
          ],
        },
        {
          name: "respiratory_rate",
          units: "count/min",
          data: hourly([
            ["2026-10-13 01:00:00", 14],
            ["2026-10-13 04:00:00", 15],
          ]),
        },
        {
          name: "blood_oxygen_saturation",
          units: "%",
          data: hourly([
            ["2026-10-13 02:00:00", 0.96],
            ["2026-10-13 03:00:00", 0.97],
          ]),
        },
        {
          name: "apple_sleeping_wrist_temperature",
          units: "degF",
          data: hourly([["2026-10-12 22:00:00", 94.1]]),
        },
      ],
    },
  };

  it("returns night-time vitals as samples and wrist temperature on the wake date", () => {
    const out = mapHealthAutoExport(body);
    // Averaging over sleep happens once stored (OvernightMetricsService).
    expect(out.sleep).toEqual([
      { date: "2026-10-13", sleep_wrist_temp_c: 34.5 },
    ]);
    expect(out.overnightSamples).toEqual([
      // 15:00 is daytime and dropped; 07:00 is kept for a late wake.
      {
        metric: "hrv",
        sampleLocal: "2026-10-12T23:00:00",
        bucketMinutes: 60,
        value: 60,
      },
      {
        metric: "hrv",
        sampleLocal: "2026-10-13T02:00:00",
        bucketMinutes: 60,
        value: 70,
      },
      {
        metric: "hrv",
        sampleLocal: "2026-10-13T05:00:00",
        bucketMinutes: 60,
        value: 80,
      },
      {
        metric: "hrv",
        sampleLocal: "2026-10-13T07:00:00",
        bucketMinutes: 60,
        value: 20,
      },
      {
        metric: "heart_rate",
        sampleLocal: "2026-10-13T01:00:00",
        bucketMinutes: 60,
        value: 52,
      },
      {
        metric: "heart_rate",
        sampleLocal: "2026-10-13T03:00:00",
        bucketMinutes: 60,
        value: 55,
      },
      {
        metric: "heart_rate",
        sampleLocal: "2026-10-13T12:00:00",
        bucketMinutes: 60,
        value: 95,
      },
      {
        metric: "respiratory_rate",
        sampleLocal: "2026-10-13T01:00:00",
        bucketMinutes: 60,
        value: 14,
      },
      {
        metric: "respiratory_rate",
        sampleLocal: "2026-10-13T04:00:00",
        bucketMinutes: 60,
        value: 15,
      },
      {
        metric: "spo2",
        sampleLocal: "2026-10-13T02:00:00",
        bucketMinutes: 60,
        value: 96,
      },
      {
        metric: "spo2",
        sampleLocal: "2026-10-13T03:00:00",
        bucketMinutes: 60,
        value: 97,
      },
    ]);
    // Hourly HRV never overwrites the daily `hrv` the baseline is built on.
    expect(out.sleep[0]).not.toHaveProperty("hrv");
    expect(out.dailyMetrics).toEqual([]);
  });

  it("keeps HRV readings off the hour as single readings", () => {
    const out = mapHealthAutoExport({
      data: {
        metrics: [
          {
            name: "heart_rate_variability",
            units: "ms",
            data: [
              { date: "2026-10-13 02:31:05 -0500", qty: 62 },
              { date: "2026-10-13 05:12:40 -0500", qty: 70 },
            ],
          },
        ],
      },
    });
    expect(
      out.overnightSamples.map((s) => [s.sampleLocal, s.bucketMinutes]),
    ).toEqual([
      ["2026-10-13T02:31:05", 0],
      ["2026-10-13T05:12:40", 0],
    ]);
  });

  it("still treats one point per day at midnight as daily HRV", () => {
    const out = mapHealthAutoExport({
      data: {
        metrics: [
          {
            name: "heart_rate_variability",
            units: "ms",
            data: hourly([
              ["2026-10-12 00:00:00", 44],
              ["2026-10-13 00:00:00", 48],
            ]),
          },
        ],
      },
    });
    expect(out.sleep).toEqual([
      { date: "2026-10-12", hrv: 44 },
      { date: "2026-10-13", hrv: 48 },
    ]);
  });
});

describe("mapHealthAutoExport Zone 2 and daylight", () => {
  const ride = {
    id: "ride-1",
    name: "Indoor Cycling",
    start: "2026-10-13 17:00:00 -0500",
    end: "2026-10-13 17:10:00 -0500",
    duration: 600,
    heartRateData: [100, 112, 118, 125, 127, 131, 135, 126, 120, 108].map(
      (bpm, i) => ({
        date: `2026-10-13 17:${String(i).padStart(2, "0")}:00 -0500`,
        Avg: bpm,
      }),
    ),
  };

  it("counts minutes inside the Zone 2 band from workout heart rate", () => {
    const out = mapHealthAutoExport(
      { data: { workouts: [ride] } },
      { zone2Bpm: [110, 128] },
    );
    // 112, 118, 125, 127, 126, 120: six one-minute readings in band.
    expect(out.workouts[0]?.zone2_minutes).toBe(6);
  });

  it("leaves Zone 2 unset without a band or heart rate series", () => {
    expect(
      mapHealthAutoExport({ data: { workouts: [ride] } }).workouts[0],
    ).not.toHaveProperty("zone2_minutes");
    expect(
      mapHealthAutoExport(
        { data: { workouts: [{ ...ride, heartRateData: undefined }] } },
        { zone2Bpm: [110, 128] },
      ).workouts[0],
    ).not.toHaveProperty("zone2_minutes");
  });

  // Ten one-minute power readings: warm-up, eight in 97-130 W, cool-down.
  const cyclingPower = [60, 100, 110, 118, 125, 130, 128, 115, 105, 70].map(
    (watts, i) => ({
      date: `2026-10-13 17:${String(i).padStart(2, "0")}:00 -0500`,
      qty: watts,
      units: "W",
    }),
  );

  it("credits Zone 2 by power when the ride has power samples", () => {
    const out = mapHealthAutoExport(
      { data: { workouts: [{ ...ride, cyclingPower }] } },
      { zone2Bpm: [110, 128], zone2Watts: [97, 130] },
    );
    expect(out.workouts[0]?.zone2_minutes).toBe(8);
    expect(out.workouts[0]?.avg_power_watts).toBe(106);
  });

  it("credits Zone 2 by heart rate when told to, even with power", () => {
    const out = mapHealthAutoExport(
      { data: { workouts: [{ ...ride, cyclingPower }] } },
      {
        zone2Bpm: [110, 128],
        zone2Watts: [97, 130],
        zone2CreditBy: "heart_rate",
      },
    );
    expect(out.workouts[0]?.zone2_minutes).toBe(6);
    expect(out.workouts[0]?.avg_power_watts).toBe(106);
  });

  it("leaves Zone 2 unset in heart rate mode when the ride has no heart rate", () => {
    const out = mapHealthAutoExport(
      {
        data: {
          workouts: [{ ...ride, heartRateData: undefined, cyclingPower }],
        },
      },
      {
        zone2Bpm: [110, 128],
        zone2Watts: [97, 130],
        zone2CreditBy: "heart_rate",
      },
    );
    expect(out.workouts[0]).not.toHaveProperty("zone2_minutes");
    expect(out.workouts[0]?.avg_power_watts).toBe(106);
  });

  it("falls back to heart rate when the ride has no power", () => {
    const out = mapHealthAutoExport(
      { data: { workouts: [ride] } },
      { zone2Bpm: [110, 128], zone2Watts: [97, 130] },
    );
    expect(out.workouts[0]?.zone2_minutes).toBe(6);
    expect(out.workouts[0]).not.toHaveProperty("avg_power_watts");
  });

  it("keeps the Peloton copy with power and borrows the Watch's heart rate", () => {
    const watch = {
      ...ride,
      id: "WATCH",
      avgHeartRate: { qty: 121, units: "bpm" },
      maxHeartRate: { qty: 135, units: "bpm" },
    };
    const peloton = {
      ...ride,
      id: "PELO",
      start: "2026-10-13 17:00:30 -0500",
      heartRateData: undefined,
      cyclingPower,
    };
    const out = mapHealthAutoExport(
      { data: { workouts: [watch, peloton] } },
      { zone2Bpm: [110, 128], zone2Watts: [97, 130] },
    );
    expect(out.workouts).toHaveLength(1);
    expect(out.workouts[0]).toMatchObject({
      workout_id: "PELO",
      avg_power_watts: 106,
      zone2_minutes: 8,
      avg_heart_rate: 121,
      max_heart_rate: 135,
    });
  });

  // 40 one-minute readings: 10 min warm-up at 80 W, 25 min at 115 W with
  // 5 min at 200 W in the middle, then 5 min at 90 W.
  const longRide = (() => {
    const at = (i: number) => {
      const t = new Date(Date.UTC(2026, 9, 14, 22, 0) + i * 60000);
      return `${t.toISOString().slice(0, 10)} ${t.toISOString().slice(11, 19)} +0000`;
    };
    const watts = (i: number) =>
      i < 10 ? 80 : i >= 20 && i < 25 ? 200 : i < 35 ? 115 : 90;
    const bpm = (i: number) => (i < 10 ? 110 : i >= 20 && i < 25 ? 150 : 125);
    const minutes = Array.from({ length: 40 }, (_, i) => i);
    return {
      id: "long-1",
      name: "Indoor Cycling",
      start: at(0),
      end: at(40),
      duration: 2400,
      cyclingPower: minutes.map((i) => ({
        date: at(i),
        qty: watts(i),
        units: "W",
        source: "Peloton",
      })),
      heartRateData: minutes.map((i) => ({
        date: at(i),
        Avg: bpm(i),
        source: "Nick’s Apple Watch",
      })),
    };
  })();

  it("measures best 5 and 20 min power and heart rate at Zone 2 watts", () => {
    const out = mapHealthAutoExport(
      { data: { workouts: [longRide] } },
      { zone2Bpm: [121, 140], zone2Watts: [97, 130] },
    );
    expect(out.workouts[0]).toMatchObject({
      best_5min_watts: 200,
      // Minutes 10-29: 15 at 115 W and 5 at 200 W.
      best_20min_watts: 136,
      zone2_heart_rate: 125,
      heart_rate_sources: ["Nick’s Apple Watch"],
      power_sources: ["Peloton"],
    });
  });

  it("drops best power values a glitch pushes past 2000 W", () => {
    const glitched = {
      ...longRide,
      cyclingPower: longRide.cyclingPower.map((p, i) =>
        i === 30 ? { ...p, qty: 20000 } : p,
      ),
    };
    const out = mapHealthAutoExport(
      { data: { workouts: [glitched] } },
      { zone2Watts: [97, 130] },
    );
    expect(out.workouts[0]).not.toHaveProperty("best_5min_watts");
  });

  it("prefers strap heart rate relayed by Peloton over the Watch", () => {
    const strap = longRide.heartRateData.map((p) => ({
      ...p,
      Avg: p.Avg! - 4,
      source: "Peloton",
    }));
    const out = mapHealthAutoExport(
      {
        data: {
          workouts: [
            {
              ...longRide,
              heartRateData: [...longRide.heartRateData, ...strap],
            },
          ],
        },
      },
      { zone2Watts: [97, 130] },
    );
    expect(out.workouts[0]?.zone2_heart_rate).toBe(121);
  });

  it("borrows the Watch copy's heart rate when Peloton's copy has only power", () => {
    const peloton = { ...longRide, id: "PELO", heartRateData: undefined };
    const watch = { ...longRide, id: "WATCH", cyclingPower: undefined };
    const out = mapHealthAutoExport(
      { data: { workouts: [watch, peloton] } },
      { zone2Watts: [97, 130] },
    );
    expect(out.workouts).toHaveLength(1);
    expect(out.workouts[0]).toMatchObject({
      workout_id: "PELO",
      zone2_heart_rate: 125,
    });
  });

  it("skips heart rate at Zone 2 watts with under 10 minutes in the band", () => {
    const short = {
      ...longRide,
      cyclingPower: longRide.cyclingPower.slice(0, 18),
    };
    const out = mapHealthAutoExport(
      { data: { workouts: [short] } },
      { zone2Watts: [97, 130] },
    );
    expect(out.workouts[0]).not.toHaveProperty("zone2_heart_rate");
    expect(out.workouts[0]).not.toHaveProperty("best_20min_watts");
  });

  it("sums hourly daylight between 05:00 and 09:59 per day", () => {
    const out = mapHealthAutoExport({
      data: {
        metrics: [
          {
            name: "time_in_daylight",
            units: "min",
            data: [
              { date: "2026-10-13 06:00:00 -0500", qty: 4 },
              { date: "2026-10-13 07:00:00 -0500", qty: 9 },
              { date: "2026-10-13 12:00:00 -0500", qty: 30 },
              { date: "2026-10-12 09:00:00 -0500", qty: 3 },
            ],
          },
        ],
      },
    });
    expect(out.morningDaylight).toEqual([
      { date: "2026-10-13", minutes: 13 },
      { date: "2026-10-12", minutes: 3 },
    ]);
  });

  it("ignores a daily daylight total, which says nothing about the morning", () => {
    const out = mapHealthAutoExport({
      data: {
        metrics: [
          {
            name: "time_in_daylight",
            units: "min",
            data: [{ date: "2026-10-13 00:00:00 -0500", qty: 45 }],
          },
        ],
      },
    });
    expect(out.morningDaylight).toEqual([]);
  });
});
