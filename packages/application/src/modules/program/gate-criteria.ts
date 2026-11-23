import type {
  IsoDate,
  KneeCheck,
  KneeTest,
  ProgramGate,
} from "@fitness-app/domain";
import { addDays, daysBetween } from "./program-calendar";
import {
  bestBySide,
  latestHq,
  latestValue,
  legExtensionSymmetry,
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
/** The crane test is monthly: its LSI stays current this long. */
export const CRANE_GATE_STALE_DAYS = 35;
/** AROM: L flexion within this many degrees of R (same day) is full. */
export const FLEX_TOLERANCE_DEG = 5;
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
  /** Dates a pogo set was logged (pogos tolerated: next morning's check). */
  pogoDates?: IsoDate[];
};

type Reading = { value: number; date: IsoDate } | null;

function judge(
  key: string,
  label: string,
  reading: Reading,
  ok: (v: number) => boolean,
  today: IsoDate,
  format: (v: number) => string = (v) => `${v}`,
  staleDays: number = GATE_STALE_DAYS,
): GateCriterion {
  if (!reading) {
    return { key, label, state: "missing", detail: null, date: null };
  }
  const stale = daysBetween(reading.date, today) > staleDays;
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

/** The PT or ortho OK as one criterion; clearing the gate is separate. */
function clinicianRow(gate: ProgramGate | null, today: IsoDate): GateCriterion {
  const on = gate?.clinicianOkOn ?? null;
  const by = gate?.clinicianOkBy ?? null;
  return {
    key: "clinician",
    label: "PT or ortho OK",
    state: on != null && on <= today ? "pass" : "missing",
    detail: on ? `${on}${by ? ` by ${CLEARED_BY_LABEL[by]}` : ""}` : null,
    date: on,
  };
}

/**
 * Pogos tolerated: the morning after the last logged pogo session has a knee
 * check with swelling trace or less and graft pain 2 or less.
 */
function pogoRow(
  pogoDates: IsoDate[],
  checks: GateInputs["checks"],
  today: IsoDate,
): GateCriterion {
  const key = "pogo";
  const label = "Pogos tolerated (next-morning knee check)";
  const last = [...pogoDates]
    .filter((d) => d <= today)
    .sort()
    .at(-1);
  if (!last) {
    return { key, label, state: "missing", detail: null, date: null };
  }
  const next = addDays(last, 1);
  const check = checks.find((c) => c.date === next);
  if (!check || check.swelling == null || check.graftPain == null) {
    return {
      key,
      label,
      state: "missing",
      detail: next > today ? "check tomorrow morning" : "no check next morning",
      date: last,
    };
  }
  const ok =
    SWELLING_OK.has(String(check.swelling)) && Number(check.graftPain) <= 2;
  return {
    key,
    label,
    state:
      daysBetween(last, today) > GATE_STALE_DAYS
        ? "stale"
        : ok
          ? "pass"
          : "fail",
    detail: `${check.swelling}, pain ${check.graftPain}`,
    date: last,
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
 * Quad strength reads two tests (2026-11-23): the monthly crane LSI and the
 * weekly single-leg leg extension symmetry, each against the board's target.
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
      `Quad LSI (crane) ${target}% or more`,
      quad,
      (v) => v >= target,
      today,
      pct,
      CRANE_GATE_STALE_DAYS,
    );
  const legExt = legExtensionSymmetry(tests).filter((r) => r.symmetry != null);
  const lastLegExt = legExt[legExt.length - 1];
  const legExtRow = (target: number) =>
    judge(
      "leg_ext",
      `Leg extension symmetry ${target}% or more`,
      lastLegExt
        ? { value: lastLegExt.symmetry as number, date: lastLegExt.date }
        : null,
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
  // Active flexion measured on both legs the same day also counts; the
  // newer of the two tests decides.
  const arom = bestBySide(tests, "flexion_active").filter(
    (p) => p.left != null && p.right != null,
  );
  const aromLast = arom[arom.length - 1];
  const flexion =
    aromLast && (!htbLast || aromLast.date >= htbLast.date)
      ? judge(
          "flexion",
          `Flexion: AROM L within ${FLEX_TOLERANCE_DEG}° of R`,
          { value: aromLast.right! - aromLast.left!, date: aromLast.date },
          (v) => v <= FLEX_TOLERANCE_DEG,
          today,
          (v) => (v <= 0 ? "L matches R" : `L ${v}° short`),
        )
      : judge(
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
      legExtRow(lsi1),
      extension,
      flexion,
      swelling,
      graft,
      asymRow,
      pogoRow(input.pogoDates ?? [], checks, today),
      clinicianRow(gate("jog"), today),
    ]),
    board("plyo", "Plyometrics", "plyo_double", [
      quadRow(lsi2),
      legExtRow(lsi2),
      stepDown,
      sts,
      swelling,
      graft,
      clinicianRow(gate("plyo_double"), today),
    ]),
    board("rts", "Return to sport", "rts", [
      quadRow(lsi3),
      legExtRow(lsi3),
      hqRow,
      ...hops,
      rsi,
      asymRow,
      clinicianRow(gate("rts"), today),
    ]),
  ];
}
