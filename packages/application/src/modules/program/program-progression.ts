import type {
  ProgramExerciseCategory,
  IsoDate,
  KneeReadinessStatus,
  LoadKind,
  ProgramBlock,
  ProgramExercise,
  ProgramMuscle,
  StrengthSession,
} from "@fitness-app/domain";
import { addDays } from "./program-calendar";
import type { QuadDrop } from "./knee-tests";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
} from "./program-settings";

/** Last block's RIR when it was not logged [assumed]. */
export const DEFAULT_LOGGED_RIR = 2;
/** Epley stops being useful past about 15 reps to failure. */
const MAX_REPS_TO_FAILURE_FOR_ESTIMATE = 15;

type LoadSteps = Pick<
  ProgramSettings,
  | "barbellStepLb"
  | "cuffStepLb"
  | "dumbbellFineStepLb"
  | "dumbbellCoarseStepLb"
  | "dumbbellFineLimitLb"
> &
  Partial<Pick<ProgramSettings, "dumbbellMaxLb">>;

export function nextDumbbell(
  load: number,
  steps: LoadSteps = DEFAULT_PROGRAM_SETTINGS,
) {
  return load < steps.dumbbellFineLimitLb
    ? load + steps.dumbbellFineStepLb
    : load + steps.dumbbellCoarseStepLb;
}

/** The next load up (settings: +5 barbell, +2.5 cuff, next DB); null for bodyweight and band. */
export function nextLoad(
  load: number,
  kind: LoadKind,
  steps: LoadSteps = DEFAULT_PROGRAM_SETTINGS,
): number | null {
  switch (kind) {
    case "barbell":
      return load + steps.barbellStepLb;
    case "cuff":
      return load + steps.cuffStepLb;
    case "dumbbell":
      return nextDumbbell(load, steps);
    default:
      return null;
  }
}

/** True when a dumbbell load is at (or past) the heaviest dumbbell owned. */
export function atDumbbellMax(
  load: number,
  kind: LoadKind,
  steps: LoadSteps = DEFAULT_PROGRAM_SETTINGS,
) {
  return (
    kind === "dumbbell" &&
    steps.dumbbellMaxLb != null &&
    load >= steps.dumbbellMaxLb
  );
}

/** Caps a dumbbell load at the heaviest dumbbell; other kinds pass through. */
export function capDumbbell(
  load: number,
  kind: LoadKind,
  steps: LoadSteps = DEFAULT_PROGRAM_SETTINGS,
) {
  return kind === "dumbbell" && steps.dumbbellMaxLb != null
    ? Math.min(load, steps.dumbbellMaxLb)
    : load;
}

export const DUMBBELL_MAX_REASON = (maxLb: number) =>
  `Dumbbells top out at ${maxLb} lb: hold the load and follow the exercise note (slower tempo first, then the barbell).`;

/** Rounds down to a load the equipment can make. */
export function roundDownToLoadStep(
  load: number,
  kind: LoadKind,
  steps: LoadSteps = DEFAULT_PROGRAM_SETTINGS,
) {
  const floorTo = (step: number) => Math.floor(load / step + 1e-9) * step;
  switch (kind) {
    case "barbell":
      return floorTo(steps.barbellStepLb);
    case "cuff":
      return floorTo(steps.cuffStepLb);
    case "dumbbell":
      return load < steps.dumbbellFineLimitLb
        ? floorTo(steps.dumbbellFineStepLb)
        : floorTo(steps.dumbbellCoarseStepLb);
    default:
      return load;
  }
}

export type PrescriptionScheme = {
  setsMin: number | null;
  setsMax: number | null;
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
};

type SchemeSource = Pick<
  ProgramBlock,
  "setsMin" | "setsMax" | "repsMin" | "repsMax" | "rirTarget"
>;

/**
 * An exercise's own prescription, else its block's, else the block whose
 * sessions it runs (a deload uses the block before it).
 */
export function effectiveScheme(
  exercise: Pick<
    ProgramExercise,
    "setsMin" | "setsMax" | "repsMin" | "repsMax" | "rirTarget"
  >,
  block: SchemeSource | null,
  sourceBlock: SchemeSource | null = null,
): PrescriptionScheme {
  const pick = <K extends keyof PrescriptionScheme>(key: K) =>
    exercise[key] ?? block?.[key] ?? sourceBlock?.[key] ?? null;
  return {
    setsMin: pick("setsMin"),
    setsMax: pick("setsMax"),
    repsMin: pick("repsMin"),
    repsMax: pick("repsMax"),
    rirTarget: pick("rirTarget"),
  };
}

/**
 * Sets to load: the low end in a block's first week, the high end after it.
 * Deload weeks take one set off the high end (never below 1); plyo volume
 * halves instead (rounded up).
 */
export function plannedSetCount(
  scheme: Pick<PrescriptionScheme, "setsMin" | "setsMax">,
  weekIndexInBlock: number,
  isDeload: boolean,
  category: ProgramExerciseCategory | null = null,
) {
  const low = scheme.setsMin ?? scheme.setsMax ?? 3;
  const high = scheme.setsMax ?? scheme.setsMin ?? 3;
  if (isDeload) {
    return category === "plyo"
      ? Math.max(1, Math.ceil(high / 2))
      : Math.max(1, high - 1);
  }
  return weekIndexInBlock <= 0 ? low : high;
}

export type ProgressionSet = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  isWarmup?: boolean;
  side?: "left" | "right" | null;
  durationSeconds?: number | null;
};

/** Working sets that drive progression: per-leg lifts go off the LEFT leg. */
export function progressionSets<T extends ProgressionSet>(sets: T[]): T[] {
  return sets.filter((s) => !s.isWarmup && s.side !== "right");
}

/**
 * Double progression: true when every working set reached the top of the
 * rep range at one load with at least 2 reps in reserve.
 */
export function hitTopOfRange(
  sets: ProgressionSet[],
  repsTop: number | null,
  minRir: number = DEFAULT_PROGRAM_SETTINGS.progressionMinRir,
) {
  const working = progressionSets(sets);
  if (repsTop == null || working.length === 0) return false;
  const load = working[0]?.weight ?? null;
  return working.every(
    (s) =>
      s.weight === load &&
      s.reps != null &&
      s.reps >= repsTop &&
      s.rir != null &&
      s.rir >= minRir,
  );
}

/** Estimated one-rep max from load, reps and reps in reserve (Epley). */
export function estimatedMax(weight: number, reps: number, rir: number) {
  const toFailure = Math.min(reps + rir, MAX_REPS_TO_FAILURE_FOR_ESTIMATE);
  return weight * (1 + toFailure / 30);
}

/**
 * Steps between two rep ranges on the program's ladder of block rep tops
 * (12, 8, 5 ...). Positive = fewer reps (heavier). A change that skips no
 * rung still counts as one step.
 */
export function repRangeSteps(
  lastRepsMax: number,
  newRepsMax: number,
  ladder: number[] = [],
): number {
  if (lastRepsMax === newRepsMax) return 0;
  const down = newRepsMax < lastRepsMax;
  const lo = Math.min(lastRepsMax, newRepsMax);
  const hi = Math.max(lastRepsMax, newRepsMax);
  const rungs = new Set(
    ladder.filter((v) => (down ? v >= lo && v < hi : v > lo && v <= hi)),
  ).size;
  return (down ? 1 : -1) * Math.max(1, rungs);
}

/**
 * Starting load for a new block: last block's top working load (left leg
 * or bilateral) x 1.1 for each step down in reps (divided for a step up),
 * rounded down to a load the equipment makes. 100 lb for 10-12 gives 110
 * lb for 6-8.
 */
export function newBlockStartLoad(
  sets: ProgressionSet[],
  steps: number,
  kind: LoadKind,
  settings: LoadSteps &
    Pick<ProgramSettings, "newBlockLoadMultiplier"> = DEFAULT_PROGRAM_SETTINGS,
): number | null {
  const loads = progressionSets(sets)
    .map((s) => s.weight ?? 0)
    .filter((w) => w > 0);
  if (loads.length === 0) return null;
  const raw = Math.max(...loads) * settings.newBlockLoadMultiplier ** steps;
  return roundDownToLoadStep(raw, kind, settings);
}

export type LoadSuggestion = {
  load: number | null;
  kind: "increase" | "same" | "new_block" | "start";
  /** True when an increase was earned but a rule held it back. */
  held: boolean;
  reason: string;
};

export type SuggestLoadInput = {
  loadKind: LoadKind;
  scheme: PrescriptionScheme;
  /** All sets from the last session that had this exercise. */
  lastSets: ProgressionSet[];
  /** Top of the rep range in force when those sets were logged. */
  lastRepsMax: number | null;
  /** Rep tops of the program's blocks, for counting steps between blocks. */
  repLadder?: number[];
  readiness: KneeReadinessStatus | null;
  isDeload: boolean;
  /** Average sleep over the last few nights; null when there is no data. */
  sleepAverageHours?: number | null;
  /** Left quad crane-test drop past the setting (knee-tests.ts); holds loads. */
  quadDrop?: QuadDrop | null;
  /** "legs" lets barbell lifts under the fast-step ceiling jump by the larger step. */
  part?: "legs" | "upper";
  settings?: ProgramSettings;
};

/**
 * Average hours asleep over the `nights` check-ins ending on `today`
 * (check-ins are dated by wake day). Null when none of them has sleep.
 */
export function sleepAverageHours(
  rows: { checkinDate: IsoDate; sleepDurationMinutes: number | null }[],
  today: IsoDate,
  nights: number,
): number | null {
  const from = addDays(today, -(Math.max(1, nights) - 1));
  const minutes = rows
    .filter(
      (r) =>
        r.checkinDate >= from &&
        r.checkinDate <= today &&
        r.sleepDurationMinutes != null &&
        r.sleepDurationMinutes > 0,
    )
    .map((r) => r.sleepDurationMinutes as number);
  if (minutes.length === 0) return null;
  return minutes.reduce((a, b) => a + b, 0) / minutes.length / 60;
}

/**
 * Why an earned increase is held back today, or null: only on a normal knee
 * check, outside a deload, when recent sleep averages at least the setting
 * (6.5 h), and when the left quad crane test has not dropped past its
 * setting (65 N) week over week.
 */
export function progressionLock(
  input: Pick<
    SuggestLoadInput,
    "readiness" | "isDeload" | "sleepAverageHours" | "quadDrop" | "settings"
  >,
): string | null {
  const settings = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
  if (input.readiness !== "normal") {
    return input.readiness == null
      ? "Do the knee check first."
      : "Knee check not normal: repeat last loads.";
  }
  if (input.isDeload) return "Deload week: no load increase.";
  if (
    input.sleepAverageHours != null &&
    input.sleepAverageHours < settings.sleepMinHoursForIncrease
  ) {
    return `Sleep averaged ${input.sleepAverageHours.toFixed(1)} h over ${settings.sleepAverageNights} nights (under ${settings.sleepMinHoursForIncrease}): no load increase.`;
  }
  if (input.quadDrop && input.quadDrop.dropN > settings.quadDropHoldN) {
    return quadDropReason(input.quadDrop);
  }
  return null;
}

/** The progression-lock line for a left quad crane-test drop. */
export function quadDropReason(drop: QuadDrop) {
  return `Left quad down ${drop.dropN} N on the ${drop.date} crane test (${drop.previousLeft} to ${drop.left} N): repeat last loads.`;
}

/** RIR an exercise must reach to earn an increase: its target, else the setting. */
function earnRir(scheme: PrescriptionScheme, settings: ProgramSettings) {
  return scheme.rirTarget ?? settings.progressionMinRir;
}

export const FIND_LOAD_REASON =
  "Find load: work up to a weight you can lift for the top of the range at the target RIR, then log it.";

/**
 * Next session's load. Increases only when every set hit the top of the
 * range at the target RIR or better, and `progressionLock` allows it; a
 * changed rep range (new block) starts from last block's best set. No
 * history: "Find load".
 */
export function suggestLoad(input: SuggestLoadInput): LoadSuggestion {
  const settings = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
  const working = progressionSets(input.lastSets);
  if (working.length === 0) {
    return {
      load: null,
      kind: "start",
      held: false,
      reason: FIND_LOAD_REASON,
    };
  }

  const lastLoad = Math.max(...working.map((s) => s.weight ?? 0));
  const lock = progressionLock(input);
  const minRir = earnRir(input.scheme, settings);

  const loaded =
    input.loadKind !== "bodyweight" &&
    input.loadKind !== "band" &&
    lastLoad > 0;

  const repRangeChanged =
    input.lastRepsMax != null &&
    input.scheme.repsMax != null &&
    input.lastRepsMax !== input.scheme.repsMax;

  if (loaded && repRangeChanged && !lock) {
    const steps = repRangeSteps(
      input.lastRepsMax as number,
      input.scheme.repsMax as number,
      input.repLadder ?? [],
    );
    const raw = newBlockStartLoad(working, steps, input.loadKind, settings);
    const start =
      raw != null ? capDumbbell(raw, input.loadKind, settings) : null;
    if (start != null) {
      const range = [input.scheme.repsMin, input.scheme.repsMax]
        .filter((v, i, all) => v != null && (i === 0 || v !== all[0]))
        .join("–");
      return {
        load: start,
        kind: "new_block",
        held: false,
        reason: `Suggested start for ${range} reps: last block's top load x ${settings.newBlockLoadMultiplier}${Math.abs(steps) > 1 ? `^${Math.abs(steps)}` : ""}${steps < 0 ? " (divided: more reps)" : ""}${raw != null && start < raw ? `, capped at the ${start} lb dumbbell max` : ""}. Edit if it feels off.`,
      };
    }
  }

  const earned = hitTopOfRange(working, input.scheme.repsMax, minRir);
  if (!loaded) {
    return {
      load: lastLoad > 0 ? lastLoad : null,
      kind: "same",
      held: earned && lock != null,
      reason: earned
        ? (lock ?? "Top of the range: add reps or a harder variation.")
        : "Same as last time.",
    };
  }
  if (earned && !lock && atDumbbellMax(lastLoad, input.loadKind, settings)) {
    return {
      load: lastLoad,
      kind: "same",
      held: true,
      reason: DUMBBELL_MAX_REASON(settings.dumbbellMaxLb),
    };
  }
  if (earned && !lock) {
    const fastLegStep =
      input.part === "legs" &&
      input.loadKind === "barbell" &&
      settings.legBarbellFastStepLb > 0 &&
      lastLoad < settings.legBarbellFastStepUntilLb;
    const next = fastLegStep
      ? Math.min(
          lastLoad + settings.legBarbellFastStepLb,
          Math.max(
            settings.legBarbellFastStepUntilLb,
            lastLoad + settings.barbellStepLb,
          ),
        )
      : capDumbbell(
          nextLoad(lastLoad, input.loadKind, settings) ?? lastLoad,
          input.loadKind,
          settings,
        );
    return {
      load: next,
      kind: "increase",
      held: false,
      reason: `Every set hit ${input.scheme.repsMax} with ${minRir}+ in reserve: up to ${next}.`,
    };
  }
  return {
    load: lastLoad,
    kind: "same",
    held: earned,
    reason:
      earned && lock
        ? lock
        : `Same load: not every set reached the top of the range at RIR ${minRir}+.`,
  };
}

export type HoldSuggestion = {
  seconds: number | null;
  kind: "increase" | "same" | "start";
  held: boolean;
  reason: string;
};

/**
 * Holds progress like loads: every working set at or past the target time
 * last session earns +5 s (setting) next time, under the same locks.
 */
export function suggestHoldSeconds(input: {
  targetSeconds: number | null;
  lastSets: ProgressionSet[];
  readiness: KneeReadinessStatus | null;
  isDeload: boolean;
  sleepAverageHours?: number | null;
  quadDrop?: QuadDrop | null;
  settings?: ProgramSettings;
}): HoldSuggestion {
  const settings = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
  const durations = progressionSets(input.lastSets)
    .map((s) => s.durationSeconds ?? null)
    .filter((d): d is number => d != null && d > 0);
  if (durations.length === 0) {
    return {
      seconds: input.targetSeconds,
      kind: "start",
      held: false,
      reason: "First time: hold for the target.",
    };
  }
  const shortest = Math.min(...durations);
  const base = Math.max(shortest, input.targetSeconds ?? 0);
  const earned = input.targetSeconds == null || shortest >= input.targetSeconds;
  const lock = progressionLock(input);
  if (earned && !lock) {
    const next = base + settings.holdStepSeconds;
    return {
      seconds: next,
      kind: "increase",
      held: false,
      reason: `Every set held ${shortest} s: up to ${next} s.`,
    };
  }
  return {
    seconds: earned ? base : (input.targetSeconds ?? shortest),
    kind: "same",
    held: earned,
    reason:
      earned && lock ? lock : "Same hold: not every set reached the target.",
  };
}

/** Bodyweight pull-ups and chin-ups: add load once total reps reach the setting. */
export function pullUpLoadCue(
  exerciseName: string,
  lastSets: ProgressionSet[],
  settings: Pick<
    ProgramSettings,
    "pullUpLoadAtTotalReps"
  > = DEFAULT_PROGRAM_SETTINGS,
): string | null {
  if (!/\b(pull|chin)-?ups?\b/i.test(exerciseName)) return null;
  const working = progressionSets(lastSets);
  if (working.length === 0) return null;
  if (working.some((s) => (s.weight ?? 0) > 0)) return null;
  const total = working.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  return total >= settings.pullUpLoadAtTotalReps
    ? `${total} total reps last time: add load (belt or DB between the feet).`
    : null;
}

export type LegExerciseInfo = {
  primaryMuscle: ProgramMuscle | null;
  measure: ProgramExercise["measure"];
  countsAsQuadSet: boolean;
};

export function programExerciseKey(name: string) {
  return name.trim().toLowerCase();
}

/** Program leg exercises by name (and their substitutes), for counting sets. */
export function legExerciseIndex(
  exercises: (Pick<
    ProgramExercise,
    "name" | "primaryMuscle" | "measure" | "substituteName"
  > &
    Partial<Pick<ProgramExercise, "countsAsQuadSet">>)[],
): Map<string, LegExerciseInfo> {
  const index = new Map<string, LegExerciseInfo>();
  for (const ex of exercises) {
    const info = {
      primaryMuscle: ex.primaryMuscle,
      measure: ex.measure,
      countsAsQuadSet: ex.countsAsQuadSet ?? false,
    };
    index.set(programExerciseKey(ex.name), info);
    if (ex.substituteName) {
      index.set(programExerciseKey(ex.substituteName), info);
    }
  }
  return index;
}

export type HardSetCount = {
  total: number;
  byMuscle: Partial<Record<ProgramMuscle, number>>;
  /** Hard sets of exercises flagged counts_as_quad_set: the 12-16 counter. */
  quadSets: number;
};

/**
 * Hard leg sets between two dates (inclusive): working, rep-based sets of a
 * program leg exercise at the hard-set RIR or less (4; blank RIR counts). A per-leg
 * exercise counts its left-leg sets only, so one L+R pair is one set.
 */
export function weeklyHardLegSets(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  index: Map<string, LegExerciseInfo>,
  range: { start: string; end: string },
  hardSetMaxRir: number = DEFAULT_PROGRAM_SETTINGS.hardSetMaxRir,
): HardSetCount {
  const result: HardSetCount = { total: 0, byMuscle: {}, quadSets: 0 };
  for (const session of sessions) {
    if (session.sessionDate < range.start || session.sessionDate > range.end) {
      continue;
    }
    for (const set of session.sets) {
      const info = index.get(programExerciseKey(set.exerciseName));
      if (!info || info.measure !== "reps") continue;
      if (!info.primaryMuscle && !info.countsAsQuadSet) continue;
      if (set.isWarmup || set.side === "right") continue;
      if (set.reps == null || set.reps <= 0) continue;
      if (set.rir != null && set.rir > hardSetMaxRir) continue;
      result.total += 1;
      if (info.countsAsQuadSet) result.quadSets += 1;
      if (info.primaryMuscle) {
        result.byMuscle[info.primaryMuscle] =
          (result.byMuscle[info.primaryMuscle] ?? 0) + 1;
      }
    }
  }
  return result;
}

export type ExerciseProgressPoint = {
  date: string;
  /** Top working load; bilateral sets land here. */
  load: number | null;
  leftLoad: number | null;
  rightLoad: number | null;
  leftPeakNewtons: number | null;
  rightPeakNewtons: number | null;
};

function maxOrNull(values: (number | null | undefined)[]) {
  const present = values.filter((v): v is number => v != null && v > 0);
  return present.length > 0 ? Math.max(...present) : null;
}

/** One point per session for an exercise, oldest first. */
export function exerciseProgress(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  exerciseName: string,
): ExerciseProgressPoint[] {
  const key = programExerciseKey(exerciseName);
  return [...sessions]
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .flatMap((session) => {
      const sets = session.sets.filter(
        (s) => !s.isWarmup && programExerciseKey(s.exerciseName) === key,
      );
      if (sets.length === 0) return [];
      const side = (which: "left" | "right") =>
        sets.filter((s) => s.side === which);
      return [
        {
          date: session.sessionDate,
          load: maxOrNull(sets.filter((s) => !s.side).map((s) => s.weight)),
          leftLoad: maxOrNull(side("left").map((s) => s.weight)),
          rightLoad: maxOrNull(side("right").map((s) => s.weight)),
          leftPeakNewtons: maxOrNull(
            side("left").map((s) => s.peakForceNewtons),
          ),
          rightPeakNewtons: maxOrNull(
            side("right").map((s) => s.peakForceNewtons),
          ),
        },
      ];
    });
}
