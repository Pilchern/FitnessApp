import { describe, expect, it } from "vitest";
import { buildTrendNotes, type TrendNoteInput } from "../../index";

const TODAY = "2026-10-12";

function input(overrides: Partial<TrendNoteInput> = {}): TrendNoteInput {
  return {
    today: TODAY,
    strengthSessions: [],
    cardioSessions: [],
    bodyMetrics: [],
    recovery: [],
    ...overrides,
  };
}

function daysAgo(n: number) {
  const d = new Date(`${TODAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function ride(n: number, minutes: number) {
  return {
    sessionDate: daysAgo(n),
    durationMinutes: minutes,
    plannedVsCompleted: "completed",
    sessionKind: "zone2",
  };
}

describe("buildTrendNotes", () => {
  it("says nothing without data", () => {
    expect(buildTrendNotes(input())).toEqual([]);
  });

  it("reports a strength gain across the last four sessions and ignores warm-ups", () => {
    const sessions = [165, 165, 170, 175].map((weight, i) => ({
      sessionDate: daysAgo(21 - i * 7),
      sets: [
        {
          exerciseName: "Barbell Bench Press",
          weight: 225,
          reps: 3,
          isWarmup: true,
        },
        {
          exerciseName: "Barbell Bench Press",
          weight,
          reps: 8,
          isWarmup: false,
        },
      ],
    }));
    const notes = buildTrendNotes(input({ strengthSessions: sessions }));
    expect(notes[0]?.key).toBe("strength:barbell bench press");
    expect(notes[0]?.text).toBe(
      "Barbell Bench Press is up 6% (estimated max) over your last 4 sessions.",
    );
  });

  it("ignores a small strength wobble", () => {
    const sessions = [165, 167.5, 165, 167.5].map((weight, i) => ({
      sessionDate: daysAgo(21 - i * 7),
      sets: [{ exerciseName: "Bench", weight, reps: 8, isWarmup: false }],
    }));
    expect(buildTrendNotes(input({ strengthSessions: sessions }))).toEqual([]);
  });

  it("compares cardio minutes per week across two 4-week windows", () => {
    const cardioSessions = [
      ride(2, 45),
      ride(5, 30),
      ride(9, 45),
      ride(16, 45),
      ride(23, 45),
      ride(30, 30),
      ride(40, 30),
      ride(50, 30),
    ];
    const notes = buildTrendNotes(input({ cardioSessions }));
    expect(notes).toEqual([
      {
        key: "cardio",
        tone: "positive",
        text: "Cardio is up to 53 min a week, from 23, over the last 4 weeks.",
      },
    ]);
  });

  it("does not compare cardio against an empty prior window", () => {
    const cardioSessions = [ride(2, 45), ride(5, 30), ride(9, 45)];
    expect(buildTrendNotes(input({ cardioSessions }))).toEqual([]);
  });

  it("calls a sub-1 lb monthly change steady", () => {
    const bodyMetrics = [
      { measuredOn: daysAgo(1), weightLb: 190.4 },
      { measuredOn: daysAgo(6), weightLb: 190.0 },
      { measuredOn: daysAgo(30), weightLb: 189.8 },
      { measuredOn: daysAgo(35), weightLb: 190.0 },
    ];
    const [note] = buildTrendNotes(input({ bodyMetrics }));
    expect(note?.text).toBe(
      "Weight has held steady over the past month (+0.3 lb, two-week averages).",
    );
  });

  it("measures wake times against the plan target", () => {
    const recovery = ["06:29", "07:37", "06:40", "06:10"].map((t, i) => ({
      checkinDate: daysAgo(i),
      restingHeartRate: null,
      wakeTimeLocal: t,
    }));
    const [note] = buildTrendNotes(input({ recovery, wakeTarget: "06:30" }));
    expect(note).toEqual({
      key: "wake",
      tone: "attention",
      text: "Up within 30 min of 6:30 AM on 3 of 4 days this week (6:10 AM to 7:37 AM).",
    });
  });

  it("flags resting heart rate above the 30-day norm only with enough data", () => {
    const recovery = Array.from({ length: 30 }, (_, i) => ({
      checkinDate: daysAgo(i),
      restingHeartRate: i < 7 ? 66 : 60,
      wakeTimeLocal: null,
    }));
    const [note] = buildTrendNotes(input({ recovery }));
    expect(note?.key).toBe("rhr");
    expect(note?.tone).toBe("attention");
    expect(buildTrendNotes(input({ recovery: recovery.slice(0, 10) }))).toEqual(
      [],
    );
  });
});
