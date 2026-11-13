import type {
  IsoDate,
  KneeCheck,
  KneeTest,
  ProgramGate,
} from "@fitness-app/domain";
import { daysBetween } from "./program-calendar";
import {
  bestBySide,
  latestHq,
  latestValue,
  lsiPct,
  quadLsiTrend,
} from "./knee-tests";

/**
 * The jog, plyo and return-to-sport gate criteria, ported from the PT
 * Tracker's RTS core: each criterion green (pass), red (fail) or grey
 * (missing, or measured too long ago), from the latest knee_tests rows and
 * the daily knee checks. Clearing a gate stays a person's call (PT, ortho,
 * or met criteria); this only shows where each criterion stands.
 */

export type CriterionState = "pass" | "fail" | "missing" | "stale";

export type GateCriterion = {
  key: string;
  label: string;
  state: CriterionState;
  /** What was read, for display: "74.1%", "trace, none, none". */
  detail: string | null;
  date: IsoDate | null;
};

export type GateBoard = {
  key: "jog" | "plyo" | "rts";
  title: string;
  /** The program_gates row this board clears (plyo uses plyo_double). */
  gateKey: string;
  gate: ProgramGate | null;
  criteria: GateCriterion[];
  met: number;
  total: number;
  status: "cleared" | "ready" | "not_yet";
};

/** A measurement older than this shows grey, never green. */
export const GATE_STALE_DAYS = 14;
/** Knee checks: the last 3 must include one from the last few days. */
export const GATE_CHECK_RECENT_DAYS = 3;
/** Heel-to-butt: L within this many cm of R counts as full flexion. */
export const FLEX_TOLERANCE_CM = 2;

export type GateInputs = {
  tests: KneeTest[];
  /** Daily knee checks, any order. */
  checks: (KneeCheck & { date: IsoDate })[];
  gates: ProgramGate[];
  today: IsoDate;
  lsiTargets: [number, number, number];
  walkingAsymmetryTargetPct: number;
};

type Reading = { value: number; date: IsoDate } | null;

function judge(
  key: string,
  label: string,
  reading: Reading,
  ok: (v: number) => boolean,
  today: IsoDate,
  format: (v: number) => string = (v) => `${v}`,
): GateCriterion {
  if (!reading) {
    return { key, label, state: "missing", detail: null, date: null };
  }
  const stale = daysBetween(reading.date, today) > GATE_STALE_DAYS;
  return {
    key,
    label,
    state: stale ? "stale" : ok(reading.value) ? "pass" : "fail",
    detail: format(reading.value),
    date: reading.date,
  };
}

function pairLsi(
  tests: KneeTest[],
  type: string,
  lowerIsBetter = false,
): Reading {
  const pairs = bestBySide(tests, type).filter(
    (p) => p.left != null && p.right != null,
  );
  const p = pairs[pairs.length - 1];
  if (!p) return null;
  // Timed hop: faster is better, and bestBySide keeps the highest time, so
  // use the fastest trial per side instead.
  if (lowerIsBetter) {
    const fastest = (side: "L" | "R") =>
      Math.min(
        ...tests
          .filter(
            (t) =>
              t.testType === type &&
              t.testDate === p.date &&
              t.side === side &&
              t.value > 0,
          )
          .map((t) => t.value),
      );
    const lsi = lsiPct(fastest("R"), fastest("L"));
    return lsi == null ? null : { value: lsi, date: p.date };
  }
  const lsi = lsiPct(p.left, p.right);
  return lsi == null ? null : { value: lsi, date: p.date };
}

function lastThreeChecks(
  key: string,
  label: string,
  checks: GateInputs["checks"],
  pick: (c: KneeCheck) => string | number | null,
  ok: (v: string | number) => boolean,
  today: IsoDate,
): GateCriterion {
  const rows = checks
    .filter((c) => pick(c) != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (rows.length < 3) {
    return {
      key,
      label,
      state: "missing",
      detail: rows.length ? `${rows.length} of 3 logged` : null,
      date: rows[0]?.date ?? null,
    };
  }
  const values = rows.map((c) => pick(c) as string | number);
  const stale = daysBetween(rows[0]!.date, today) > GATE_CHECK_RECENT_DAYS;
  return {
    key,
    label,
    state: stale ? "stale" : values.every(ok) ? "pass" : "fail",
    detail: values.join(", "),
    date: rows[0]!.date,
  };
}

function dateRow(gate: ProgramGate | null, today: IsoDate): GateCriterion {
  const earliest = gate?.earliestOn ?? null;
  if (!earliest) {
    return {
      key: "date",
      label: "No earliest date set",
      state: "pass",
      detail: null,
      date: null,
    };
  }
  const left = daysBetween(today, earliest);
  return {
    key: "date",
    label: `On or after ${earliest}`,
    state: left <= 0 ? "pass" : "fail",
    detail: left > 0 ? `${left} days to go` : null,
    date: earliest,
  };
}

function clearedRow(gate: ProgramGate | null, today: IsoDate): GateCriterion {
  const on = gate?.clearedOn ?? null;
  const by = gate?.clearedBy ?? null;
  return {
    key: "cleared",
    label: "Cleared (PT, ortho or criteria)",
    state: on != null && on <= today ? "pass" : "fail",
    detail: on ? `${on}${by ? ` by ${CLEARED_BY_LABEL[by]}` : ""}` : null,
    date: on,
  };
}

export const CLEARED_BY = ["pt", "ortho", "self_criteria"] as const;
export type ClearedBy = (typeof CLEARED_BY)[number];
export const CLEARED_BY_LABEL: Record<ClearedBy, string> = {
  pt: "PT",
  ortho: "ortho",
  self_criteria: "criteria met",
};

const pct = (v: number) => `${v}%`;
const SWELLING_OK = new Set(["none", "trace"]);

/**
 * The three gate boards, each criterion judged against today's data.
 *
 * TODO(v2.19): the quad criteria still read the crane LSI only. The weekly
 * single-leg leg extension symmetry (legExtensionSymmetry) is shown beside it
 * but not used here; redefine the jog, plyo and RTS quad criteria after the
 * 11/16-11/22 cross-calibration. RTS: 90% for golf and running, 100% before
 * cutting sports. The crane is monthly now, so GATE_STALE_DAYS (14) greys the
 * crane LSI for part of each month; settle that in the same change.
 */
export function gateBoards(input: GateInputs): GateBoard[] {
  const { tests, checks, gates, today } = input;
  const [lsi1, lsi2, lsi3] = input.lsiTargets;
  const gate = (key: string) => gates.find((g) => g.gateKey === key) ?? null;

  const trend = quadLsiTrend(tests);
  const lastLsi = trend[trend.length - 1];
  const quad: Reading = lastLsi
    ? { value: lastLsi.lsi, date: lastLsi.date }
    : null;
  const quadRow = (target: number) =>
    judge(
      "quad_lsi",
      `Quad LSI ${target}% or more`,
      quad,
      (v) => v >= target,
      today,
      pct,
    );

  const asym = latestValue(tests, "walking_asymmetry", today);
  const asymRow = judge(
    "walk_asym",
    `Walking asymmetry under ${input.walkingAsymmetryTargetPct}%`,
    asym,
    (v) => v < input.walkingAsymmetryTargetPct,
    today,
    pct,
  );

  const swelling = lastThreeChecks(
    "swelling",
    "Swelling trace or less, last 3 knee checks",
    checks,
    (c) => c.swelling,
    (v) => SWELLING_OK.has(String(v)),
    today,
  );
  const graft = lastThreeChecks(
    "graft",
    "Graft pain 2 or less, last 3 knee checks",
    checks,
    (c) => c.graftPain,
    (v) => Number(v) <= 2,
    today,
  );

  const latestCheck = [...checks]
    .filter((c) => c.extensionFull != null)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const heel = latestValue(tests, "heel_height", today);
  const extension: GateCriterion = latestCheck
    ? judge(
        "extension",
        "Full extension",
        { value: latestCheck.extensionFull ? 1 : 0, date: latestCheck.date },
        (v) => v === 1,
        today,
        (v) => (v === 1 ? "full" : "not full"),
      )
    : judge(
        "extension",
        "Full extension (heel height 0)",
        heel,
        (v) => v <= 0,
        today,
        (v) => `${v} cm`,
      );

  const htb = bestBySide(
    tests.map((t) =>
      // Heel-to-butt: smaller is better; flip so best-of keeps the closest.
      t.testType === "heel_to_butt" ? { ...t, value: 1000 - t.value } : t,
    ),
    "heel_to_butt",
  ).filter((p) => p.left != null && p.right != null);
  const htbLast = htb[htb.length - 1];
  const flexion = judge(
    "flexion",
    `Flexion: heel-to-butt L within ${FLEX_TOLERANCE_CM} cm of R`,
    htbLast
      ? {
          value: Math.round((htbLast.right! - htbLast.left!) * 10) / 10,
          date: htbLast.date,
        }
      : null,
    (v) => v <= FLEX_TOLERANCE_CM,
    today,
    (v) => `L ${v} cm further`,
  );

  const stepDown = judge(
    "step_down",
    "Step-down clean on the left",
    latestValue(
      tests.filter((t) => t.side === "L"),
      "step_down",
      today,
    ),
    (v) => v === 1,
    today,
    (v) => (v === 1 ? "clean" : "faults"),
  );
  const sts = judge(
    "sts_lsi",
    "Single-leg sit-to-stand LSI 80% or more",
    pairLsi(tests, "single_leg_sit_to_stand"),
    (v) => v >= 80,
    today,
    pct,
  );

  const hq = latestHq(tests, today);
  const hqRow = judge(
    "hq",
    "Left H:Q at or above right",
    hq && hq.left != null && hq.right != null
      ? { value: hq.left >= hq.right ? 1 : 0, date: hq.date }
      : null,
    (v) => v === 1,
    today,
    () => `L ${hq?.left} / R ${hq?.right}`,
  );
  const hops = (
    [
      ["hop_single", "Single hop"],
      ["hop_triple", "Triple hop"],
      ["hop_crossover", "Crossover hop"],
      ["hop_6m_timed", "6 m timed hop"],
    ] as const
  ).map(([type, label]) =>
    judge(
      type,
      `${label} LSI 90% or more`,
      pairLsi(tests, type, type === "hop_6m_timed"),
      (v) => v >= 90,
      today,
      pct,
    ),
  );
  const rsi = judge(
    "acl_rsi",
    "ACL-RSI 80% or more",
    latestValue(tests, "acl_rsi", today),
    (v) => v >= 80,
    today,
    pct,
  );

  const board = (
    key: GateBoard["key"],
    title: string,
    gateKey: string,
    criteria: GateCriterion[],
  ): GateBoard => {
    const g = gate(gateKey);
    const all = [...criteria, dateRow(g, today), clearedRow(g, today)];
    const met = all.filter((c) => c.state === "pass").length;
    const cleared = g?.clearedOn != null && g.clearedOn <= today;
    const ready = all
      .filter((c) => c.key !== "cleared")
      .every((c) => c.state === "pass");
    return {
      key,
      title,
      gateKey,
      gate: g,
      criteria: all,
      met,
      total: all.length,
      status: cleared ? "cleared" : ready ? "ready" : "not_yet",
    };
  };

  return [
    board("jog", "Jog", "jog", [
      quadRow(lsi1),
      extension,
      flexion,
      swelling,
      graft,
      asymRow,
    ]),
    board("plyo", "Plyometrics", "plyo_double", [
      quadRow(lsi2),
      stepDown,
      sts,
      swelling,
      graft,
    ]),
    board("rts", "Return to sport", "rts", [
      quadRow(lsi3),
      hqRow,
      ...hops,
      rsi,
      asymRow,
    ]),
  ];
}
