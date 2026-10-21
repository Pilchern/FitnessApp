import { describe, expect, it } from "vitest";
import type { KneeTest, StrengthSession } from "@fitness-app/domain";
import {
  bestBySide,
  hqRatio,
  kneeTestSummary,
  latestHq,
  latestQuadLsi,
  leftQuadDrop,
  lsiPct,
  quadLsiTrend,
} from "./knee-tests";
import {
  DUMBBELL_MAX_REASON,
  progressionLock,
  quadDropReason,
  suggestLoad,
  suggestHoldSeconds,
} from "./program-progression";
import { DEFAULT_PROGRAM_SETTINGS } from "./program-settings";

const t = (
  testDate: string,
  testType: string,
  side: "L" | "R" | null,
  value: number,
  repIndex = 1,
): KneeTest => ({
  testDate,
  testType,
  side,
  value,
  unit: "N",
  repIndex,
  source: "pt_tracker",
  notes: null,
});

const crane = (date: string, l: number[], r: number[]) => [
  ...l.map((v, i) => t(date, "quad_iso_90", "L", v, i + 1)),
  ...r.map((v, i) => t(date, "quad_iso_90", "R", v, i + 1)),
];

const isoSession = (
  sessionDate: string,
  exerciseName: string,
  left: number,
  right: number,
) =>
  ({
    sessionDate,
    sets: [
      {
        exerciseName,
        side: "left",
        peakForceNewtons: left,
        weight: null,
        reps: null,
        isWarmup: false,
      },
      {
        exerciseName,
        side: "right",
        peakForceNewtons: right,
        weight: null,
        reps: null,
        isWarmup: false,
      },
    ],
  }) as unknown as Pick<StrengthSession, "sessionDate" | "sets">;

describe("LSI and H:Q maths (same rules as the PT Tracker)", () => {
  it("LSI is L / R x 100 to one decimal, null without both legs", () => {
    expect(lsiPct(250, 480)).toBe(52.1);
    expect(lsiPct(500, 400)).toBe(125);
    expect([lsiPct(250, null), lsiPct(null, 480), lsiPct(250, 0)]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("H:Q is ham / quad to two decimals", () => {
    expect(hqRatio(200, 250)).toBe(0.8);
    expect(hqRatio(null, 250)).toBeNull();
  });

  it("takes the best trial per leg and date", () => {
    expect(
      bestBySide(crane("2026-10-18", [300, 320, 310], [470]), "quad_iso_90"),
    ).toEqual([{ date: "2026-10-18", left: 320, right: 470 }]);
  });

  it("latest 90° LSI from the crane test; 60° from logged isometrics", () => {
    const tests = [
      ...crane("2026-10-11", [280], [460]),
      ...crane("2026-10-18", [320], [480]),
    ];
    const sessions = [
      isoSession("2026-10-20", "Isometric Knee Extension (60°)", 250, 400),
    ];
    expect(latestQuadLsi(tests, sessions, 90)).toEqual({
      date: "2026-10-18",
      left: 320,
      right: 480,
      lsi: 66.7,
      source: "pt_tracker",
    });
    expect(latestQuadLsi(tests, sessions, 60)).toMatchObject({
      lsi: 62.5,
      source: "logged",
    });
    expect(latestQuadLsi(tests, sessions, 90, "2026-10-12")?.lsi).toBe(60.9);
  });

  it("a newer logged 90° max wins; the crane test wins a same-day tie", () => {
    const tests = crane("2026-10-18", [320], [480]);
    const name = "Isometric Knee Extension (90°)";
    expect(
      latestQuadLsi(tests, [isoSession("2026-10-23", name, 360, 480)], 90)
        ?.source,
    ).toBe("logged");
    expect(
      latestQuadLsi(tests, [isoSession("2026-10-18", name, 360, 480)], 90)
        ?.source,
    ).toBe("pt_tracker");
  });

  it("H:Q per leg on the newest test with both muscles", () => {
    const tests = [
      ...crane("2026-10-18", [300], [500]),
      t("2026-10-18", "ham_iso_90", "L", 180),
      t("2026-10-18", "ham_iso_90", "R", 260),
      ...crane("2026-10-25", [340], [500]),
    ];
    expect(latestHq(tests)).toEqual({
      date: "2026-10-18",
      left: 0.6,
      right: 0.52,
    });
  });

  it("LSI trend per crane test, oldest first", () => {
    const tests = [
      ...crane("2026-10-18", [320], [480]),
      ...crane("2026-10-11", [280], [460]),
      ...crane("2026-10-25", [400], []),
    ];
    expect(quadLsiTrend(tests)).toEqual([
      { date: "2026-10-11", lsi: 60.9 },
      { date: "2026-10-18", lsi: 66.7 },
    ]);
  });
});

describe("left quad drop > 65 N week over week holds loads", () => {
  const tests = [
    ...crane("2026-10-11", [340], [480]),
    ...crane("2026-10-18", [270, 274], [480]),
  ];

  it("flags a drop over the threshold on the newest test", () => {
    expect(leftQuadDrop(tests, "2026-10-19", 65)).toEqual({
      date: "2026-10-18",
      previousDate: "2026-10-11",
      left: 274,
      previousLeft: 340,
      dropN: 66,
    });
  });

  it("exactly 65 N is noise, not a drop; a rise never holds", () => {
    const at65 = [
      ...crane("2026-10-11", [340], [480]),
      ...crane("2026-10-18", [275], [480]),
    ];
    expect(leftQuadDrop(at65, "2026-10-19", 65)).toBeNull();
    const rise = [
      ...crane("2026-10-11", [270], []),
      ...crane("2026-10-18", [340], []),
    ];
    expect(leftQuadDrop(rise, "2026-10-19", 65)).toBeNull();
  });

  it("stops holding once the newest test is over 14 days old, or with one test", () => {
    expect(leftQuadDrop(tests, "2026-11-01", 65)).not.toBeNull();
    expect(leftQuadDrop(tests, "2026-11-02", 65)).toBeNull();
    expect(
      leftQuadDrop(crane("2026-10-18", [270], [480]), "2026-10-19", 65),
    ).toBeNull();
  });

  it("ignores tests dated after today", () => {
    expect(leftQuadDrop(tests, "2026-10-17", 65)).toBeNull();
  });

  const drop = leftQuadDrop(tests, "2026-10-19", 65)!;
  const base = {
    loadKind: "barbell" as const,
    scheme: { setsMin: 3, setsMax: 3, repsMin: 10, repsMax: 10, rirTarget: 2 },
    lastSets: [10, 10, 10].map((reps) => ({ weight: 95, reps, rir: 2 })),
    lastRepsMax: 10,
    readiness: "normal" as const,
    isDeload: false,
  };

  it("locks an earned increase with the drop as the reason", () => {
    expect(suggestLoad({ ...base, quadDrop: drop })).toEqual({
      load: 95,
      kind: "same",
      held: true,
      reason: quadDropReason(drop),
    });
    expect(suggestLoad({ ...base, quadDrop: null }).kind).toBe("increase");
    expect(
      suggestHoldSeconds({
        targetSeconds: 30,
        lastSets: [
          { weight: null, reps: null, rir: null, durationSeconds: 30 },
        ],
        readiness: "normal",
        isDeload: false,
        quadDrop: drop,
      }),
    ).toMatchObject({ seconds: 30, held: true });
  });

  it("the threshold comes from settings", () => {
    const settings = { ...DEFAULT_PROGRAM_SETTINGS, quadDropHoldN: 80 };
    expect(
      progressionLock({
        readiness: "normal",
        isDeload: false,
        quadDrop: drop,
        settings,
      }),
    ).toBeNull();
  });

  it("the summary carries every gate number", () => {
    const s = kneeTestSummary({
      tests,
      sessions: [],
      upTo: "2026-10-19",
      quadDropHoldN: 65,
    });
    expect([
      s.quad90?.lsi,
      s.quad60,
      s.quadDrop?.dropN,
      s.walkingAsymmetry,
    ]).toEqual([57.1, null, 66, null]);
  });
});

describe("dumbbell max (52.5 lb)", () => {
  const sets = (weight: number) =>
    [12, 12, 12].map((reps) => ({ weight, reps, rir: 2 }));
  const base = {
    loadKind: "dumbbell" as const,
    scheme: { setsMin: 3, setsMax: 3, repsMin: 10, repsMax: 12, rirTarget: 2 },
    lastRepsMax: 12,
    readiness: "normal" as const,
    isDeload: false,
  };

  it("caps the next step at the heaviest dumbbell", () => {
    expect(suggestLoad({ ...base, lastSets: sets(50) })).toMatchObject({
      load: 52.5,
      kind: "increase",
    });
    expect(suggestLoad({ ...base, lastSets: sets(45) })).toMatchObject({
      load: 50,
      kind: "increase",
    });
  });

  it("at the max: same load, held, pointing to the exercise note", () => {
    expect(suggestLoad({ ...base, lastSets: sets(52.5) })).toEqual({
      load: 52.5,
      kind: "same",
      held: true,
      reason: DUMBBELL_MAX_REASON(52.5),
    });
  });

  it("caps a new block's start load", () => {
    const s = suggestLoad({
      ...base,
      scheme: { ...base.scheme, repsMin: 6, repsMax: 8 },
      lastSets: sets(50),
      repLadder: [12, 8],
    });
    expect(s).toMatchObject({ load: 52.5, kind: "new_block" });
    expect(s.reason).toContain("capped at the 52.5 lb dumbbell max");
  });

  it("barbell loads are not capped", () => {
    expect(
      suggestLoad({ ...base, loadKind: "barbell", lastSets: sets(135) }).load,
    ).toBe(140);
  });
});
