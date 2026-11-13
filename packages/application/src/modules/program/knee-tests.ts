import type { IsoDate, KneeTest, StrengthSession } from "@fitness-app/domain";
import { addDays, daysBetween } from "./program-calendar";
import { exerciseProgress, programExerciseKey } from "./program-progression";

/**
 * Knee test maths over the rows the PT Tracker syncs into knee_tests, plus
 * the isometric peaks logged here. Same rules as the tracker's RTS core:
 * best trial per leg, LSI = L / R x 100 (one decimal), H:Q = ham / quad
 * (two decimals). L is the operated knee.
 */

/** Logged isometrics that count as a quad strength reading, by angle. */
export const LOGGED_ISO_EXERCISES = {
  90: "Isometric Knee Extension (90°)",
  60: "Isometric Knee Extension (60°)",
} as const;

/**
 * Latest test older than this no longer drives the quad-drop hold. The crane
 * test is monthly from v2.19 (2026-11-13), so a month plus a week of slack.
 */
export const KNEE_TEST_STALE_DAYS = 35;

export type SidePair = {
  date: IsoDate;
  left: number | null;
  right: number | null;
};

/**
 * What the quad LSI divides by. right_best = the right leg's best crane
 * reading to date, used while the right side is still unsettled;
 * same_day = that day's right best.
 */
export type LsiBasis = "same_day" | "right_best";

export type LsiReading = SidePair & {
  lsi: number | null;
  /** pt_tracker = the weekly crane test; logged = sets logged in this app. */
  source: "pt_tracker" | "logged";
  /** The right value the LSI used; null when it had none. */
  denominator?: number | null;
  basis?: LsiBasis;
};

export type QuadLsiPoint = SidePair & {
  lsi: number | null;
  denominator: number | null;
  basis: LsiBasis;
};

/**
 * The right leg settles once its last 3 test-day bests sit within this
 * spread (newtons); until then a low right day would inflate the LSI.
 */
export const RIGHT_SETTLED_SPREAD_N = 65;
export const RIGHT_SETTLED_TEST_DAYS = 3;

export type QuadDrop = {
  date: IsoDate;
  previousDate: IsoDate;
  left: number;
  previousLeft: number;
  dropN: number;
};

function round(value: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

export function lsiPct(left: number | null, right: number | null) {
  return left != null && right != null && left > 0 && right > 0
    ? round((left / right) * 100, 1)
    : null;
}

export function hqRatio(ham: number | null, quad: number | null) {
  return ham != null && quad != null && ham > 0 && quad > 0
    ? round(ham / quad, 2)
    : null;
}

/** Best value per date and leg for one test type, oldest first. */
export function bestBySide(tests: KneeTest[], testType: string): SidePair[] {
  const byDate = new Map<IsoDate, SidePair>();
  for (const t of tests) {
    if (t.testType !== testType || !(t.value > 0)) continue;
    if (t.side !== "L" && t.side !== "R") continue;
    const pair = byDate.get(t.testDate) ?? {
      date: t.testDate,
      left: null,
      right: null,
    };
    const key = t.side === "L" ? "left" : "right";
    pair[key] = Math.max(pair[key] ?? 0, t.value);
    byDate.set(t.testDate, pair);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Per-session isometric peaks (newtons) logged for one exercise, oldest first. */
export function loggedIsoPairs(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  exerciseName: string,
): SidePair[] {
  return exerciseProgress(sessions, exerciseName)
    .filter((p) => p.leftPeakNewtons != null || p.rightPeakNewtons != null)
    .map((p) => ({
      date: p.date,
      left: p.leftPeakNewtons,
      right: p.rightPeakNewtons,
    }));
}

function withLsi(pair: SidePair, source: LsiReading["source"]): LsiReading {
  return {
    ...pair,
    lsi: lsiPct(pair.left, pair.right),
    source,
    denominator: pair.right,
    basis: "same_day",
  };
}

/**
 * The newest reading with both legs, from the crane test or the logged
 * isometric at that angle; the crane test wins a tie on the same date.
 */
export function latestQuadLsi(
  tests: KneeTest[],
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  angle: 60 | 90,
  upTo?: IsoDate,
): LsiReading | null {
  const both = (p: SidePair) =>
    p.left != null && p.right != null && (!upTo || p.date <= upTo);
  const tracker =
    angle === 90
      ? quadLsiByDate(tests)
          .filter((p) => p.lsi != null && (!upTo || p.date <= upTo))
          .map((p): LsiReading => ({ ...p, source: "pt_tracker" }))
      : bestBySide(tests, `quad_iso_${angle}`)
          .filter(both)
          .map((p) => withLsi(p, "pt_tracker"));
  const logged = loggedIsoPairs(sessions, LOGGED_ISO_EXERCISES[angle])
    .filter(both)
    .map((p) => withLsi(p, "logged"));
  const all = [...logged, ...tracker].sort((a, b) =>
    a.date === b.date
      ? a.source === "pt_tracker"
        ? 1
        : -1
      : a.date.localeCompare(b.date),
  );
  return all[all.length - 1] ?? null;
}

/** H:Q per leg on the newest crane test with a hamstring and quad trial. */
export function latestHq(
  tests: KneeTest[],
  upTo?: IsoDate,
): { date: IsoDate; left: number | null; right: number | null } | null {
  const quads = new Map(
    bestBySide(tests, "quad_iso_90").map((p) => [p.date, p]),
  );
  const rows = bestBySide(tests, "ham_iso_90")
    .filter((h) => quads.has(h.date) && (!upTo || h.date <= upTo))
    .map((h) => {
      const q = quads.get(h.date) as SidePair;
      return {
        date: h.date,
        left: hqRatio(h.left, q.left),
        right: hqRatio(h.right, q.right),
      };
    })
    .filter((r) => r.left != null || r.right != null);
  return rows[rows.length - 1] ?? null;
}

/** Newest value of a sideless test (walking asymmetry, heel height). */
export function latestValue(
  tests: KneeTest[],
  testType: string,
  upTo?: IsoDate,
): { date: IsoDate; value: number } | null {
  const rows = tests
    .filter((t) => t.testType === testType && (!upTo || t.testDate <= upTo))
    .sort((a, b) => a.testDate.localeCompare(b.testDate));
  const last = rows[rows.length - 1];
  return last ? { date: last.testDate, value: last.value } : null;
}

/**
 * The quad LSI denominator for one test day. `rightHistory` is the right
 * leg's best per test day, oldest first, up to and including this day.
 * Same-day right once the last 3 days spread under 65 N, else the best
 * right reading to date.
 */
export function quadLsiDenominator(
  rightHistory: number[],
  sameDayRight: number | null,
): { denominator: number | null; basis: LsiBasis } {
  const recent = rightHistory.slice(-RIGHT_SETTLED_TEST_DAYS);
  const settled =
    sameDayRight != null &&
    recent.length >= RIGHT_SETTLED_TEST_DAYS &&
    Math.max(...recent) - Math.min(...recent) < RIGHT_SETTLED_SPREAD_N;
  if (settled) return { denominator: sameDayRight, basis: "same_day" };
  return {
    denominator: rightHistory.length > 0 ? Math.max(...rightHistory) : null,
    basis: "right_best",
  };
}

/**
 * True when a strength session the calendar day before `testDate` logged a
 * leg exercise: a crane test the morning after reads low. `legNames` holds
 * programExerciseKey() names (legExerciseIndex keys).
 */
export function legSessionDayBefore(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  legNames: { has(key: string): boolean },
  testDate: IsoDate,
): boolean {
  const dayBefore = addDays(testDate, -1);
  return sessions.some(
    (s) =>
      s.sessionDate === dayBefore &&
      s.sets.some((set) => legNames.has(programExerciseKey(set.exerciseName))),
  );
}

/** Crane quad LSI per test date with the denominator rule, oldest first. */
export function quadLsiByDate(
  tests: KneeTest[],
  testType: string = "quad_iso_90",
): QuadLsiPoint[] {
  const rights: number[] = [];
  return bestBySide(tests, testType).map((p) => {
    if (p.right != null) rights.push(p.right);
    const { denominator, basis } = quadLsiDenominator(rights, p.right);
    return { ...p, lsi: lsiPct(p.left, denominator), denominator, basis };
  });
}

/** Crane-test quad LSI at 90° per test date, oldest first. */
export function quadLsiTrend(tests: KneeTest[]) {
  return quadLsiByDate(tests)
    .filter((p): p is QuadLsiPoint & { lsi: number } => p.lsi != null)
    .map((p) => ({
      date: p.date,
      lsi: p.lsi,
      denominator: p.denominator,
      basis: p.basis,
    }));
}

/**
 * The rule "left quad peak drops more than 65 N week over week: hold
 * loads". Compares the left best on the newest crane test with the one
 * before it; null unless the drop exceeds `thresholdN` and the newest test
 * is no more than `staleDays` old (a stale test stops holding).
 */
export function leftQuadDrop(
  tests: KneeTest[],
  today: IsoDate,
  thresholdN: number,
  staleDays: number = KNEE_TEST_STALE_DAYS,
): QuadDrop | null {
  const lefts = bestBySide(tests, "quad_iso_90").filter(
    (p): p is SidePair & { left: number } => p.left != null && p.date <= today,
  );
  if (lefts.length < 2) return null;
  const latest = lefts[lefts.length - 1]!;
  const previous = lefts[lefts.length - 2]!;
  if (daysBetween(latest.date, today) > staleDays) return null;
  const dropN = round(previous.left - latest.left, 1);
  if (!(dropN > thresholdN)) return null;
  return {
    date: latest.date,
    previousDate: previous.date,
    left: latest.left,
    previousLeft: previous.left,
    dropN,
  };
}

export type KneeTestSummary = {
  quad90: LsiReading | null;
  quad60: LsiReading | null;
  hq: { date: IsoDate; left: number | null; right: number | null } | null;
  walkingAsymmetry: { date: IsoDate; value: number } | null;
  quadDrop: QuadDrop | null;
};

/** The gates numbers as of `upTo`: quad LSI at 90° and 60°, H:Q per leg, walking asymmetry, the quad-drop hold. */
export function kneeTestSummary(input: {
  tests: KneeTest[];
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[];
  upTo: IsoDate;
  quadDropHoldN: number;
}): KneeTestSummary {
  const { tests, sessions, upTo } = input;
  return {
    quad90: latestQuadLsi(tests, sessions, 90, upTo),
    quad60: latestQuadLsi(tests, sessions, 60, upTo),
    hq: latestHq(tests, upTo),
    walkingAsymmetry: latestValue(tests, "walking_asymmetry", upTo),
    quadDrop: leftQuadDrop(tests, upTo, input.quadDropHoldN),
  };
}

/** The crane isometric test is monthly from v2.19 (was weekly). */
export const CRANE_EVERY_DAYS = 28;

/** True when no 90° crane quad test (either app) is on file from the last 28 days. */
export function craneTestDue(tests: KneeTest[], today: IsoDate) {
  const last = tests
    .filter((t) => t.testType === "quad_iso_90" && t.testDate <= today)
    .reduce<IsoDate | null>(
      (latest, t) =>
        latest == null || t.testDate > latest ? t.testDate : latest,
      null,
    );
  return last == null || last <= addDays(today, -CRANE_EVERY_DAYS);
}

/** The weekly Sunday single-leg leg extension test (v2.19). */
export const LEG_EXT_TEST_TYPES = {
  reps: "sl_leg_ext_reps",
  load: "sl_leg_ext_load",
} as const;

export type LegExtensionReading = {
  date: IsoDate;
  loadL: number | null;
  loadR: number | null;
  repsL: number | null;
  repsR: number | null;
  /** L reps / R reps x 100 at the same load; null when the loads differ or a side is missing. */
  symmetry: number | null;
};

/**
 * Single-leg leg extension per test date, oldest first: same load each leg,
 * reps to RIR 1, left first. Symmetry = L reps / R reps x 100 (one decimal).
 *
 * TODO(v2.19): this sits alongside the crane LSI and does not feed the jog,
 * plyo or RTS gate criteria yet. Redefine those after the 11/16-11/22
 * cross-calibration of this test against the crane.
 */
export function legExtensionSymmetry(tests: KneeTest[]): LegExtensionReading[] {
  const byDate = new Map<IsoDate, LegExtensionReading>();
  const entry = (date: IsoDate) => {
    let r = byDate.get(date);
    if (!r) {
      r = {
        date,
        loadL: null,
        loadR: null,
        repsL: null,
        repsR: null,
        symmetry: null,
      };
      byDate.set(date, r);
    }
    return r;
  };
  for (const t of tests) {
    if (t.side !== "L" && t.side !== "R") continue;
    if (t.testType === LEG_EXT_TEST_TYPES.reps) {
      entry(t.testDate)[t.side === "L" ? "repsL" : "repsR"] = t.value;
    } else if (t.testType === LEG_EXT_TEST_TYPES.load) {
      entry(t.testDate)[t.side === "L" ? "loadL" : "loadR"] = t.value;
    }
  }
  return [...byDate.values()]
    .filter((r) => r.repsL != null || r.repsR != null)
    .map((r) => ({
      ...r,
      symmetry:
        r.loadL != null && r.loadL === r.loadR
          ? lsiPct(r.repsL, r.repsR)
          : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** ACL-RSI is scored monthly. */
export const ACL_RSI_EVERY_DAYS = 30;

/** True when no ACL-RSI score is on file from the last 30 days. */
export function aclRsiDue(tests: KneeTest[], today: IsoDate) {
  const last = latestValue(tests, "acl_rsi", today);
  return !last || last.date <= addDays(today, -ACL_RSI_EVERY_DAYS);
}
