import { describe, expect, it } from "vitest";
import {
  buildLastByExercise,
  draftWasSaved,
  formatLastPerformance,
  groupSetsByExercise,
  isTimedSet,
  parseStrengthDraft,
  renumberSets,
  selectSetsToSave,
  showsTimedWeight,
  startingDuration,
  startingWeight,
} from "./helpers";

function set(
  exerciseName: string,
  setNumber: number,
  weight: number | null,
  reps: number | null,
  isWarmup = false,
  durationSeconds: number | null = null,
) {
  return {
    exerciseName,
    setNumber,
    weight,
    reps,
    isWarmup,
    durationSeconds,
  } as never;
}

describe("buildLastByExercise", () => {
  const sessions = [
    {
      sessionDate: "2026-10-01",
      sets: [set("Barbell Bench Press", 1, 160, 8), set("Pull-Up", 1, null, 3)],
    },
    {
      sessionDate: "2026-10-06",
      sets: [
        set("Barbell Bench Press", 1, 100, 10, true),
        set("Barbell Bench Press", 2, 165, 8),
        set("Barbell Bench Press", 1, 165, 8),
        set("Barbell Bench Press", 3, 165, 7),
      ],
    },
  ];

  it("uses the most recent session per exercise, ignoring warm-ups", () => {
    const last = buildLastByExercise(sessions);
    expect(last["barbell bench press"]?.sessionDate).toBe("2026-10-06");
    expect(last["barbell bench press"]?.sets).toEqual([
      { weight: 165, reps: 8, durationSeconds: null },
      { weight: 165, reps: 8, durationSeconds: null },
      { weight: 165, reps: 7, durationSeconds: null },
    ]);
  });

  it("falls back to an older session for exercises missing from the newest", () => {
    expect(buildLastByExercise(sessions)["pull-up"]?.sessionDate).toBe(
      "2026-10-01",
    );
  });

  it("is case and whitespace insensitive on names", () => {
    const last = buildLastByExercise([
      { sessionDate: "2026-10-06", sets: [set("  DB Curl ", 1, 20, 15)] },
    ]);
    expect(last["db curl"]).toBeDefined();
  });

  it("skips exercises that only have warm-up sets", () => {
    const last = buildLastByExercise([
      { sessionDate: "2026-10-06", sets: [set("Squat", 1, 95, 5, true)] },
    ]);
    expect(last["squat"]).toBeUndefined();
  });
});

describe("formatLastPerformance", () => {
  it("shows the weight once while it stays the same", () => {
    expect(
      formatLastPerformance({
        sessionDate: "2026-10-06",
        sets: [
          { weight: 165, reps: 8, durationSeconds: null },
          { weight: 165, reps: 8, durationSeconds: null },
          { weight: 165, reps: 7, durationSeconds: null },
        ],
      }),
    ).toBe("165 x 8, 8, 7");
  });

  it("repeats the weight when it changes and handles bodyweight", () => {
    expect(
      formatLastPerformance({
        sessionDate: "2026-10-06",
        sets: [
          { weight: 165, reps: 8, durationSeconds: null },
          { weight: 155, reps: 10, durationSeconds: null },
        ],
      }),
    ).toBe("165 x 8, 155 x 10");
    expect(
      formatLastPerformance({
        sessionDate: "2026-10-06",
        sets: [
          { weight: null, reps: 4, durationSeconds: null },
          { weight: null, reps: 3, durationSeconds: null },
        ],
      }),
    ).toBe("4, 3");
  });
});

describe("startingWeight", () => {
  const last = {
    sessionDate: "2026-10-06",
    sets: [
      { weight: 165, reps: 8, durationSeconds: null },
      { weight: 160, reps: 8, durationSeconds: null },
    ],
  };

  it("uses the same set last time, then the last set, then the template", () => {
    expect(startingWeight(last, 0, 150)).toBe("165");
    expect(startingWeight(last, 1, 150)).toBe("160");
    expect(startingWeight(last, 3, 150)).toBe("160");
    expect(startingWeight(undefined, 0, 150)).toBe("150");
    expect(startingWeight(undefined, 0, null)).toBe("");
  });

  it("falls back to the template for a bodyweight last time", () => {
    expect(
      startingWeight(
        {
          sessionDate: "2026-10-06",
          sets: [{ weight: null, reps: 3, durationSeconds: null }],
        },
        0,
        10,
      ),
    ).toBe("10");
  });
});

describe("logger helpers", () => {
  it("groups consecutive sets by exercise, case-insensitively", () => {
    const groups = groupSetsByExercise([
      { exerciseName: "Pull-Up" },
      { exerciseName: "pull-up " },
      { exerciseName: "Dead Hang" },
    ]);
    expect(groups.map((g) => g.indexes)).toEqual([[0, 1], [2]]);
  });

  it("treats hangs as timed and detects explicit durations", () => {
    expect(isTimedSet({ exerciseName: "Dead Hang", durationSeconds: "" })).toBe(
      true,
    );
    expect(isTimedSet({ exerciseName: "Row", durationSeconds: "30" })).toBe(
      true,
    );
    expect(isTimedSet({ exerciseName: "Row", durationSeconds: "" })).toBe(
      false,
    );
    expect(
      isTimedSet({ exerciseName: "Single-Leg Balance", durationSeconds: "" }),
    ).toBe(true);
  });

  it("shows weight on timed sets only when loaded", () => {
    expect(showsTimedWeight({ exerciseName: "Farmer Carry", weight: "" })).toBe(
      true,
    );
    expect(showsTimedWeight({ exerciseName: "Dead Hang", weight: "" })).toBe(
      false,
    );
    expect(showsTimedWeight({ exerciseName: "Dead Hang", weight: "10" })).toBe(
      true,
    );
  });

  it("saves only ticked sets once any is ticked, otherwise all", () => {
    expect(
      selectSetsToSave([{ done: true }, { done: false }, { done: true }]),
    ).toHaveLength(2);
    expect(selectSetsToSave([{ done: false }, {}])).toHaveLength(2);
  });

  it("renumbers sets within each exercise group", () => {
    const out = renumberSets([
      { exerciseName: "A", setNumber: 3 },
      { exerciseName: "a", setNumber: 9 },
      { exerciseName: "B", setNumber: 2 },
    ]);
    expect(out.map((x) => x.setNumber)).toEqual([1, 2, 1]);
  });
});

describe("timed sets", () => {
  const last = buildLastByExercise([
    {
      sessionDate: "2026-10-08",
      sets: [
        set("Dead Hang", 1, null, null, false, 30),
        set("Dead Hang", 2, null, null, false, 25),
      ],
    },
  ])["dead hang"];

  it("formats seconds for the Last line", () => {
    expect(last && formatLastPerformance(last)).toBe("30s, 25s");
  });

  it("shows the load on loaded timed sets", () => {
    const carry = buildLastByExercise([
      {
        sessionDate: "2026-10-08",
        sets: [set("Farmer Carry", 1, 95, null, false, 60)],
      },
    ])["farmer carry"];
    expect(carry && formatLastPerformance(carry)).toBe("95 x 60s");
  });

  it("starts each set at last time's seconds, else the last set's", () => {
    expect(startingDuration(last, 0)).toBe("30");
    expect(startingDuration(last, 1)).toBe("25");
    expect(startingDuration(last, 2)).toBe("25");
    expect(startingDuration(undefined, 0)).toBe("");
  });
});

describe("parseStrengthDraft", () => {
  const now = Date.parse("2026-10-13T01:00:00Z");
  const values = {
    sessionDate: "2026-10-12",
    sessionName: "Tue Push",
    notes: "",
    durationMinutes: "",
    readinessPre: "",
    energyPost: "",
    completedAsPlanned: true,
    sets: [
      {
        exerciseName: "Bench Press",
        setNumber: 1,
        reps: "8",
        weight: "135",
        rir: "2",
        isWarmup: false,
        durationSeconds: "",
        distanceMeters: "",
        notes: "",
        done: true,
      },
    ],
  };

  it("restores a recent draft with ticked sets", () => {
    const raw = JSON.stringify({ savedAt: now - 60_000, values });
    const draft = parseStrengthDraft(raw, now);
    expect(draft?.values.sets[0]?.done).toBe(true);
    expect(draft?.exerciseNotes).toEqual({});
    expect(draft?.planNotes).toBeNull();
  });

  it("drops missing, malformed, stale and empty drafts", () => {
    expect(parseStrengthDraft(null, now)).toBeNull();
    expect(parseStrengthDraft("{not json", now)).toBeNull();
    expect(
      parseStrengthDraft(
        JSON.stringify({ savedAt: now - 19 * 3600_000, values }),
        now,
      ),
    ).toBeNull();
    expect(
      parseStrengthDraft(
        JSON.stringify({
          savedAt: now,
          values: {
            ...values,
            sets: [{ ...values.sets[0], exerciseName: " " }],
          },
        }),
        now,
      ),
    ).toBeNull();
  });
});

describe("draftWasSaved", () => {
  const submittedAt = Date.parse("2026-10-13T01:00:00Z");

  it("is false until Finish was tapped", () => {
    expect(draftWasSaved({}, "2026-10-13T01:00:05Z")).toBe(false);
  });

  it("matches a session created at or just before the Finish tap", () => {
    expect(draftWasSaved({ submittedAt }, "2026-10-13T01:00:01+00:00")).toBe(
      true,
    );
    // Phone clock a minute fast.
    expect(draftWasSaved({ submittedAt }, "2026-10-13T00:59:00+00:00")).toBe(
      true,
    );
  });

  it("ignores sessions saved before this workout and no sessions at all", () => {
    expect(draftWasSaved({ submittedAt }, "2026-10-12T23:00:00+00:00")).toBe(
      false,
    );
    expect(draftWasSaved({ submittedAt }, null)).toBe(false);
  });
});
