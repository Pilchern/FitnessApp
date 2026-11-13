import type { IsoDate } from "@fitness-app/domain";
import { hqRatio, LEG_EXT_TEST_TYPES, lsiPct } from "./knee-tests";

/**
 * The knee test screen: one dated entry turned into knee_tests rows
 * (source 'fitness_app'), using the same test types, units and sides as the
 * PT Tracker sync so the existing maths (best-of-3, LSI = L / R, H:Q, the
 * quad-drop hold) read both. L = operated knee.
 */
export const KNEE_TEST_SOURCE = "fitness_app";

type Trials = (number | null)[];
type PerLeg = { L: Trials; R: Trials };

export type KneeTestEntry = {
  testDate: IsoDate;
  /**
   * Weekly (Sunday): single-leg leg extension, same load each leg, reps to
   * RIR 1, left first. Load is entered once and stored per leg.
   */
  legExtension: { loadLb: number | null; L: number | null; R: number | null };
  /** Crane test knee angle; 90 unless changed. Sets the test type (quad_iso_90). */
  angleDeg: number;
  strapNote: string | null;
  /** Two sub-max warm-up pulls per side: stored, never scored. */
  quadWarmup: PerLeg;
  /** Three max pulls per side, newtons. */
  quad: PerLeg;
  ham: PerLeg;
  flexionActive: number | null;
  flexionPassive: number | null;
  extension: number | null;
  kneeGirth: { L: number | null; R: number | null };
  thighGirth: { L: number | null; R: number | null };
  /** Biweekly: heel-height difference (cm, 0 = full extension). */
  heelHeight: number | null;
  /** Biweekly: single-leg sit-to-stand reps per leg. */
  sitToStand: { L: number | null; R: number | null };
  /** Biweekly: heel-to-butt distance per leg, cm (smaller is better). */
  heelToButt: { L: number | null; R: number | null };
  /** Biweekly: step-down on the left was clean (no valgus, pelvic drop, trunk lean). */
  stepDownLeftClean: boolean | null;
  walkingAsymmetry: number | null;
  walkingSpeed: number | null;
  steps: number | null;
  /** Stroke test as 0-4: 0, trace, 1+, 2+, 3+. */
  effusionGrade: number | null;
  /** ACL-RSI total, percent. */
  aclRsi: number | null;
  hops: {
    single: PerLeg;
    triple: PerLeg;
    crossover: PerLeg;
    timed6m: PerLeg;
  };
  notes: string | null;
};

export type KneeTestRowInput = {
  testDate: IsoDate;
  testType: string;
  side: "L" | "R" | null;
  value: number;
  unit: string;
  repIndex: number;
  notes: string | null;
};

export const EFFUSION_GRADES = ["0", "trace", "1+", "2+", "3+"] as const;

/** Test types per section; a save replaces a section only when it has a value. */
export function kneeTestSections(angleDeg: number) {
  return {
    legExtension: [LEG_EXT_TEST_TYPES.reps, LEG_EXT_TEST_TYPES.load],
    crane: [
      `quad_iso_${angleDeg}`,
      `quad_iso_${angleDeg}_warmup`,
      `ham_iso_${angleDeg}`,
    ],
    rom: ["flexion_active", "flexion_passive", "extension"],
    girth: ["knee_girth", "thigh_girth"],
    biweekly: [
      "heel_height",
      "single_leg_sit_to_stand",
      "heel_to_butt",
      "step_down",
    ],
    walking: ["walking_asymmetry", "walking_speed", "steps_per_day"],
    effusion: ["effusion_stroke"],
    aclRsi: ["acl_rsi"],
    hops: ["hop_single", "hop_triple", "hop_crossover", "hop_6m_timed"],
  } as const;
}

const ok = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Rows for one entry plus the test types it replaces on that date. */
export function kneeTestEntryRows(entry: KneeTestEntry): {
  rows: KneeTestRowInput[];
  replaceTypes: string[];
} {
  const rows: KneeTestRowInput[] = [];
  const d = entry.testDate;
  const angle = entry.angleDeg;
  const craneNote = [
    angle !== 90 ? `${angle}°` : null,
    entry.strapNote ? `strap: ${entry.strapNote}` : null,
  ]
    .filter(Boolean)
    .join("; ")
    .slice(0, 500);
  const add = (
    testType: string,
    side: "L" | "R" | null,
    value: number | null | undefined,
    unit: string,
    repIndex = 1,
    notes: string | null = null,
  ) => {
    if (ok(value)) {
      rows.push({ testDate: d, testType, side, value, unit, repIndex, notes });
    }
  };
  const trials = (type: string, legs: PerLeg, unit: string, notes?: string) => {
    for (const side of ["L", "R"] as const) {
      legs[side].forEach((v, i) => {
        if (ok(v) && v > 0) add(type, side, v, unit, i + 1, notes || null);
      });
    }
  };

  for (const side of ["L", "R"] as const) {
    const reps = entry.legExtension[side];
    if (ok(reps) && reps > 0) {
      add(LEG_EXT_TEST_TYPES.reps, side, reps, "reps");
      add(LEG_EXT_TEST_TYPES.load, side, entry.legExtension.loadLb, "lb");
    }
  }
  trials(`quad_iso_${angle}_warmup`, entry.quadWarmup, "N", craneNote);
  trials(`quad_iso_${angle}`, entry.quad, "N", craneNote);
  trials(`ham_iso_${angle}`, entry.ham, "N", craneNote);
  add("flexion_active", "L", entry.flexionActive, "deg");
  add("flexion_passive", "L", entry.flexionPassive, "deg");
  add("extension", "L", entry.extension, "deg");
  add("knee_girth", "L", entry.kneeGirth.L, "cm");
  add("knee_girth", "R", entry.kneeGirth.R, "cm");
  add("thigh_girth", "L", entry.thighGirth.L, "cm");
  add("thigh_girth", "R", entry.thighGirth.R, "cm");
  add("heel_height", null, entry.heelHeight, "cm");
  add("single_leg_sit_to_stand", "L", entry.sitToStand.L, "reps");
  add("single_leg_sit_to_stand", "R", entry.sitToStand.R, "reps");
  add("heel_to_butt", "L", entry.heelToButt.L, "cm");
  add("heel_to_butt", "R", entry.heelToButt.R, "cm");
  if (entry.stepDownLeftClean != null) {
    add("step_down", "L", entry.stepDownLeftClean ? 1 : 0, "clean");
  }
  add("walking_asymmetry", null, entry.walkingAsymmetry, "%");
  add("walking_speed", null, entry.walkingSpeed, "m/s");
  add("steps_per_day", null, entry.steps, "steps");
  if (ok(entry.effusionGrade)) {
    add(
      "effusion_stroke",
      null,
      entry.effusionGrade,
      "grade",
      1,
      EFFUSION_GRADES[entry.effusionGrade] ?? null,
    );
  }
  add("acl_rsi", null, entry.aclRsi, "%");
  trials("hop_single", entry.hops.single, "cm");
  trials("hop_triple", entry.hops.triple, "cm");
  trials("hop_crossover", entry.hops.crossover, "cm");
  trials("hop_6m_timed", entry.hops.timed6m, "s");

  if (entry.notes && rows.length > 0) {
    const first = rows.find((r) => !r.testType.endsWith("_warmup")) ?? rows[0]!;
    first.notes = [first.notes, entry.notes]
      .filter(Boolean)
      .join("; ")
      .slice(0, 500);
  }

  const present = new Set(rows.map((r) => r.testType));
  const replaceTypes = Object.values(kneeTestSections(angle)).flatMap(
    (types) =>
      types.some((t) => present.has(t)) ? [...types] : ([] as string[]),
  );
  return { rows, replaceTypes };
}

export type CraneSide = {
  best: number | null;
  /** Max minus min of the max pulls, when two or more were entered. */
  spread: number | null;
  spreadFlag: boolean;
};

export type CraneSummary = {
  quad: { L: CraneSide; R: CraneSide };
  lsi: number | null;
  hq: { L: number | null; R: number | null };
};

function side(trials: Trials, spreadLimitN: number): CraneSide {
  const v = trials.filter((t): t is number => ok(t) && t > 0);
  if (v.length === 0) return { best: null, spread: null, spreadFlag: false };
  const spread = v.length >= 2 ? Math.max(...v) - Math.min(...v) : null;
  return {
    best: Math.max(...v),
    spread,
    spreadFlag: spread != null && spread > spreadLimitN,
  };
}

/**
 * Best of three per side, quad LSI (L / R best), H:Q per leg when hamstring
 * pulls are in, and a flag when one side's pulls spread more than
 * `spreadLimitN` (training_settings.quad_drop_hold_n, the crane's test-retest
 * noise): the pulls disagree beyond noise, so retest or note why.
 */
export function craneSummary(
  quad: PerLeg,
  ham: PerLeg,
  spreadLimitN: number,
): CraneSummary {
  const L = side(quad.L, spreadLimitN);
  const R = side(quad.R, spreadLimitN);
  const hamL = side(ham.L, spreadLimitN).best;
  const hamR = side(ham.R, spreadLimitN).best;
  return {
    quad: { L, R },
    lsi: lsiPct(L.best, R.best),
    hq: { L: hqRatio(hamL, L.best), R: hqRatio(hamR, R.best) },
  };
}

/** Clinic visits are their own source, so clinic ROM never overwrites home ROM. */
export const CLINIC_SOURCE = "clinic";

export const CLINIC_TEST_TYPES = [
  "clinic_visit",
  "flexion_active",
  "flexion_passive",
  "extension",
  "manual_muscle_test",
  "lefs",
] as const;

export type ClinicVisit = {
  visitDate: IsoDate;
  provider: string | null;
  flexionActive: number | null;
  flexionPassive: number | null;
  extension: number | null;
  /** As the PT wrote it: "4/5", "4+/5". */
  mmt: string | null;
  lefs: number | null;
  lefsMax: number;
  notes: string | null;
};

/** "4+/5" -> 4.5, "4-/5" -> 3.5, "4/5" -> 4; null when unreadable. */
export function mmtGrade(raw: string | null): number | null {
  if (!raw) return null;
  const m = /^\s*([0-5])\s*([+-]?)\s*(?:\/\s*5)?\s*$/.exec(raw);
  if (!m) return null;
  const base = Number(m[1]);
  return m[2] === "+" ? base + 0.5 : m[2] === "-" ? base - 0.5 : base;
}

/**
 * One clinic visit as knee_tests rows (source 'clinic'): a clinic_visit
 * marker (so a visit with notes only still counts as a PT visit), ROM on
 * the operated knee, MMT and LEFS. A re-save of the date replaces the visit.
 */
export function clinicVisitRows(visit: ClinicVisit): {
  rows: KneeTestRowInput[];
  replaceTypes: string[];
} {
  const d = visit.visitDate;
  const who = visit.provider ? `provider: ${visit.provider}` : null;
  const rows: KneeTestRowInput[] = [
    {
      testDate: d,
      testType: "clinic_visit",
      side: null,
      value: 1,
      unit: "visit",
      repIndex: 1,
      notes:
        [who, visit.notes].filter(Boolean).join("; ").slice(0, 500) || null,
    },
  ];
  const add = (
    testType: string,
    side: "L" | "R" | null,
    value: number | null,
    unit: string,
    notes: string | null = who,
  ) => {
    if (ok(value)) {
      rows.push({
        testDate: d,
        testType,
        side,
        value,
        unit,
        repIndex: 1,
        notes,
      });
    }
  };
  add("flexion_active", "L", visit.flexionActive, "deg");
  add("flexion_passive", "L", visit.flexionPassive, "deg");
  add("extension", "L", visit.extension, "deg");
  add("manual_muscle_test", "L", mmtGrade(visit.mmt), "/5", visit.mmt);
  add("lefs", null, visit.lefs, "points", `of ${visit.lefsMax}`);
  return { rows, replaceTypes: [...CLINIC_TEST_TYPES] };
}
