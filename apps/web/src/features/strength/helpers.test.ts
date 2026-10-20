import { describe, expect, it } from "vitest";
import {
  buildLastByExercise,
  draftWasSaved,
  formatDuration,
  formatLastPerformance,
  formatTopSet,
  groupSetsByExercise,
  isTimedSet,
  parseStrengthDraft,
  programLinkOnEdit,
  readyToAddLoad,
  renumberSets,
  repRangeTop,
  selectSetsToSave,
  shiftIsoDate,
  showsTimedWeight,
  startingDuration,
  startingWeight,
  templateRepTop,
} from "./helpers";

describe("programLinkOnEdit", () => {
  it("clears the program link when an edit moves the session to another date", () => {
    expect(programLinkOnEdit({ sessionDate: "2026-10-19" }, "2026-10-20")).toBe(
      null,
    );
  });

  it("leaves the link alone when the date is unchanged or the session is gone", () => {
    expect(
      programLinkOnEdit({ sessionDate: "2026-10-19" }, "2026-10-19"),
    ).toBeUndefined();
    expect(programLinkOnEdit(null, "2026-10-19")).toBeUndefined();
  });
});

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

  it("uses the template when its reps are far from last time's", () => {
    // Lateral raise: Saturday 3x15 @10, Tuesday plan 4x18 @7.5.
    const saturday = {
      sessionDate: "2026-10-10",
      sets: [{ weight: 10, reps: 15, durationSeconds: null }],
    };
    expect(startingWeight(saturday, 0, 7.5, 18)).toBe("10");
    expect(startingWeight(saturday, 0, 7.5, 19)).toBe("7.5");
    expect(startingWeight(saturday, 0, null, 19)).toBe("10");
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

describe("display and date helpers", () => {
  it("formats top sets for loaded, bodyweight and timed sets", () => {
    expect(formatTopSet(135, 8)).toBe("135 x 8");
    expect(formatTopSet(0, 3)).toBe("3 reps");
    expect(formatTopSet(null, null, 60)).toBe("60s");
    expect(formatTopSet(50, null, 60)).toBe("50 x 60s");
    expect(formatTopSet(null, null)).toBe("--");
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(90)).toBe("90s");
  });

  it("shifts calendar dates across month and DST boundaries", () => {
    expect(shiftIsoDate("2026-11-02", -6)).toBe("2026-10-27");
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftIsoDate("2026-10-12", 0)).toBe("2026-10-12");
  });
});

describe("readyToAddLoad", () => {
  const at = (weight: number | null, reps: number | null) => ({
    weight,
    reps,
    durationSeconds: null,
  });

  it("is true when every working set hit the top of the range", () => {
    expect(readyToAddLoad([at(165, 8), at(165, 8), at(165, 9)], 8)).toBe(true);
    expect(readyToAddLoad([at(30, 12), at(30, 12), at(30, 12)], "8-12")).toBe(
      true,
    );
  });

  it("ignores warm-ups", () => {
    expect(
      readyToAddLoad(
        [{ ...at(95, 5), isWarmup: true }, at(165, 8), at(165, 8)],
        8,
      ),
    ).toBe(true);
  });

  it("is false when one set fell short", () => {
    expect(readyToAddLoad([at(165, 8), at(165, 8), at(165, 7)], 8)).toBe(false);
    expect(readyToAddLoad([at(30, 12), at(30, 11)], "8-12")).toBe(false);
  });

  it("is false with mixed weights or no logged weight", () => {
    expect(readyToAddLoad([at(165, 8), at(160, 8), at(165, 8)], 8)).toBe(false);
    expect(readyToAddLoad([at(null, 3), at(null, 3)], 3)).toBe(false);
  });

  it("is false without a target or last sets", () => {
    expect(readyToAddLoad([at(165, 8)], null)).toBe(false);
    expect(readyToAddLoad([at(165, 8)], "")).toBe(false);
    expect(readyToAddLoad(undefined, 8)).toBe(false);
    expect(readyToAddLoad([], 8)).toBe(false);
  });

  it("is false for timed and distance sets", () => {
    expect(
      readyToAddLoad([{ weight: 20, reps: null, durationSeconds: 60 }], 1),
    ).toBe(false);
    expect(
      readyToAddLoad([{ weight: 20, reps: 10, durationSeconds: 30 }], 10),
    ).toBe(false);
    expect(
      readyToAddLoad(
        [{ weight: 50, reps: 10, durationSeconds: null, distanceMeters: 20 }],
        10,
      ),
    ).toBe(false);
  });
});

describe("rep targets", () => {
  it("reads the top of a range or a single number", () => {
    expect(repRangeTop("8-12")).toBe(12);
    expect(repRangeTop("18–20")).toBe(20);
    expect(repRangeTop("10")).toBe(10);
    expect(repRangeTop(15)).toBe(15);
    expect(repRangeTop("12-8")).toBeNull();
    expect(repRangeTop("AMRAP")).toBeNull();
    expect(repRangeTop(null)).toBeNull();
  });

  it("takes the top from a template note range that includes the target", () => {
    expect(templateRepTop(18, "18-20")).toBe(20);
    expect(templateRepTop(15, "last 2-3 reps hard")).toBe(15);
    expect(templateRepTop(10, null)).toBe(10);
    expect(templateRepTop(null, "8-12")).toBeNull();
  });
});
