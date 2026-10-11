import { describe, expect, it } from "vitest";
import { mapShortcutBody, readNumber, toMinutes } from "./shortcut-payload";

describe("readNumber", () => {
  it("reads what Shortcuts sends", () => {
    expect(readNumber(7210)).toBe(7210);
    expect(readNumber("7,210")).toBe(7210);
    expect(readNumber("58 count/min")).toBe(58);
    expect(readNumber("40.1 mL/kg·min")).toBe(40.1);
    expect(readNumber("")).toBeUndefined();
    expect(readNumber("none")).toBeUndefined();
    expect(readNumber(null)).toBeUndefined();
  });
});

describe("toMinutes", () => {
  it("infers hours, seconds or minutes", () => {
    expect(toMinutes(7.5)).toBe(450);
    expect(toMinutes(27000)).toBe(450);
    expect(toMinutes(450)).toBe(450);
    expect(toMinutes(0)).toBeUndefined();
  });
});

describe("mapShortcutBody", () => {
  const today = "2026-10-11";

  it("maps a full evening run onto daily metrics and sleep", () => {
    const out = mapShortcutBody(
      {
        date: "2026-10-11",
        steps: "7,410",
        resting_heart_rate: "57 count/min",
        hrv: "46.2",
        vo2_max: "",
        sleep_minutes: 431.6,
        workouts: [],
      },
      today,
    );
    expect(out.dailyMetrics).toEqual({
      date: "2026-10-11",
      steps: 7410,
      resting_heart_rate: 57,
    });
    expect(out.sleep).toEqual({
      date: "2026-10-11",
      sleep_duration_minutes: 432,
      hrv: 46.2,
      resting_heart_rate: 57,
    });
    expect(out.warnings).toEqual([]);
  });

  it("defaults the date to today and skips empty sections", () => {
    const out = mapShortcutBody({ steps: 120 }, today);
    expect(out.date).toBe(today);
    expect(out.dailyMetrics).toEqual({ date: today, steps: 120 });
    expect(out.sleep).toBeNull();
  });

  it("keeps rides, drops walks and strength, and accepts a single dictionary", () => {
    const ride = {
      type: "Indoor Cycling",
      start: "2026-10-09T17:30:00-05:00",
      end: "2026-10-09T18:15:00-05:00",
      duration_seconds: "2700",
      avg_heart_rate: "118 count/min",
      max_heart_rate: "131",
      distance_miles: "12.4",
    };
    expect(mapShortcutBody({ workouts: ride }, today).workouts).toEqual([
      {
        workout_id: "shortcut:Indoor Cycling:2026-10-09T17:30:00-05:00",
        workout_type: "Indoor Cycling",
        session_kind: "zone2",
        start: "2026-10-09T17:30:00-05:00",
        end: "2026-10-09T18:15:00-05:00",
        duration_minutes: 45,
        avg_heart_rate: 118,
        max_heart_rate: 131,
        distance_meters: 19956,
        source_name: "Apple Health (Shortcut)",
      },
    ]);

    const out = mapShortcutBody(
      {
        workouts: [
          ride,
          { ...ride, type: "Outdoor Walk" },
          { ...ride, type: "Traditional Strength Training" },
        ],
      },
      today,
    );
    expect(out.workouts).toHaveLength(1);
    expect(out.skippedWorkouts).toBe(2);
  });

  it("keeps one of a Peloton ride and the Watch's copy of it", () => {
    const peloton = {
      id: "P1",
      type: "Cycling",
      start: "2026-10-09T17:30:00-05:00",
      end: "2026-10-09T18:15:00-05:00",
    };
    const watch = {
      ...peloton,
      id: "W1",
      start: "2026-10-09T17:31:00-05:00",
      avg_heart_rate: 118,
    };
    const out = mapShortcutBody({ workouts: [peloton, watch] }, today);
    expect(out.workouts.map((w) => w.workout_id)).toEqual(["W1"]);
  });

  it("warns instead of failing on a workout it cannot read", () => {
    const out = mapShortcutBody(
      {
        steps: 5000,
        workouts: [{ type: "Cycling", start: "Oct 9, 2026 at 5:30 PM" }],
      },
      today,
    );
    expect(out.workouts).toEqual([]);
    expect(out.dailyMetrics?.steps).toBe(5000);
    expect(out.warnings[0]).toContain("ISO 8601");
  });
});
