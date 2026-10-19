import type {
  KneeReadinessStatus,
  LoadKind,
  ProgramBlock,
  ProgramExercise,
  ProgramMuscle,
  StrengthSession,
} from "@fitness-app/domain";

/** Barbell +5 lb, cuff +2.5 lb. Dumbbells: next size, see `nextDumbbell`. */
export const BARBELL_STEP_LB = 5;
export const CUFF_STEP_LB = 2.5;
/**
 * Adjustable dumbbells [assumed]: 2.5 lb steps up to 25 lb, 5 lb above.
 * Change here if the set jumps differently.
 */
export const DUMBBELL_FINE_STEP_LB = 2.5;
export const DUMBBELL_COARSE_STEP_LB = 5;
export const DUMBBELL_FINE_LIMIT_LB = 25;
/** Progression needs at least this many reps in reserve on every set. */
export const PROGRESSION_MIN_RIR = 2;
/** Last block's RIR when it was not logged [assumed]. */
export const DEFAULT_LOGGED_RIR = 2;
/** A working set at this RIR or closer to failure counts as a hard set. */
export const HARD_SET_MAX_RIR = 4;
/** Weekly hard leg-set target. */
export const WEEKLY_HARD_LEG_SETS = { min: 12, max: 16 } as const;
/** Epley stops being useful past about 15 reps to failure. */
const MAX_REPS_TO_FAILURE_FOR_ESTIMATE = 15;

export function nextDumbbell(load: number) {
  return load < DUMBBELL_FINE_LIMIT_LB
    ? load + DUMBBELL_FINE_STEP_LB
    : load + DUMBBELL_COARSE_STEP_LB;
}

/** The next load up; null for bodyweight and band work. */
export function nextLoad(load: number, kind: LoadKind): number | null {
  switch (kind) {
    case "barbell":
      return load + BARBELL_STEP_LB;
    case "cuff":
      return load + CUFF_STEP_LB;
    case "dumbbell":
      return nextDumbbell(load);
    default:
      return null;
  }
}

/** Rounds down to a load the equipment can make. */
export function roundDownToLoadStep(load: number, kind: LoadKind) {
  const floorTo = (step: number) => Math.floor(load / step + 1e-9) * step;
  switch (kind) {
    case "barbell":
      return floorTo(BARBELL_STEP_LB);
    case "cuff":
      return floorTo(CUFF_STEP_LB);
    case "dumbbell":
      return load < DUMBBELL_FINE_LIMIT_LB
        ? floorTo(DUMBBELL_FINE_STEP_LB)
        : floorTo(DUMBBELL_COARSE_STEP_LB);
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
 * Deload weeks take one set off the high end (never below 1).
 */
export function plannedSetCount(
  scheme: Pick<PrescriptionScheme, "setsMin" | "setsMax">,
  weekIndexInBlock: number,
  isDeload: boolean,
) {
  const low = scheme.setsMin ?? scheme.setsMax ?? 3;
  const high = scheme.setsMax ?? scheme.setsMin ?? 3;
  if (isDeload) return Math.max(1, high - 1);
  return weekIndexInBlock <= 0 ? low : high;
}

export type ProgressionSet = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  isWarmup?: boolean;
  side?: "left" | "right" | null;
};

/** Working sets that drive progression: per-leg lifts go off the LEFT leg. */
export function progressionSets<T extends ProgressionSet>(sets: T[]): T[] {
  return sets.filter((s) => !s.isWarmup && s.side !== "right");
}

/**
 * Double progression: true when every working set reached the top of the
 * rep range at one load with at least 2 reps in reserve.
 */
export function hitTopOfRange(sets: ProgressionSet[], repsTop: number | null) {
  const working = progressionSets(sets);
  if (repsTop == null || working.length === 0) return false;
  const load = working[0]?.weight ?? null;
  return working.every(
    (s) =>
      s.weight === load &&
      s.reps != null &&
      s.reps >= repsTop &&
      s.rir != null &&
      s.rir >= PROGRESSION_MIN_RIR,
  );
}

/** Estimated one-rep max from load, reps and reps in reserve (Epley). */
export function estimatedMax(weight: number, reps: number, rir: number) {
  const toFailure = Math.min(reps + rir, MAX_REPS_TO_FAILURE_FOR_ESTIMATE);
  return weight * (1 + toFailure / 30);
}

/**
 * Starting load for a new rep range from last block's best working set:
 * the load that leaves `targetRir` in reserve at `targetReps`, rounded down.
 * 100 lb x 10 at RIR 2 gives 110 lb for 6 reps at RIR 2 (about x1.1).
 */
export function newBlockStartLoad(
  sets: ProgressionSet[],
  targetReps: number,
  targetRir: number,
  kind: LoadKind,
): number | null {
  const estimates = progressionSets(sets)
    .filter((s) => s.weight != null && s.weight > 0 && s.reps != null)
    .map((s) =>
      estimatedMax(
        s.weight as number,
        s.reps as number,
        s.rir ?? DEFAULT_LOGGED_RIR,
      ),
    );
  if (estimates.length === 0) return null;
  const best = Math.max(...estimates);
  const raw = best / (1 + (targetReps + targetRir) / 30);
  return roundDownToLoadStep(raw, kind);
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
  readiness: KneeReadinessStatus | null;
  isDeload: boolean;
};

/**
 * Next session's load. Increases only on a normal knee check and outside a
 * deload; a changed rep range (new block) starts from last block's best set.
 */
export function suggestLoad(input: SuggestLoadInput): LoadSuggestion {
  const working = progressionSets(input.lastSets);
  if (working.length === 0) {
    return {
      load: null,
      kind: "start",
      held: false,
      reason:
        "No history yet. Pick a load you can lift for the top of the range at the target RIR.",
    };
  }

  const lastLoad = Math.max(...working.map((s) => s.weight ?? 0));
  const lock =
    input.readiness !== "normal"
      ? input.readiness == null
        ? "Do the knee check first."
        : "Knee check not normal: repeat last loads."
      : input.isDeload
        ? "Deload week: no load increase."
        : null;

  const loaded =
    input.loadKind !== "bodyweight" &&
    input.loadKind !== "band" &&
    lastLoad > 0;

  const repRangeChanged =
    input.lastRepsMax != null &&
    input.scheme.repsMax != null &&
    input.lastRepsMax !== input.scheme.repsMax;

  if (loaded && repRangeChanged && !lock) {
    const start = newBlockStartLoad(
      working,
      input.scheme.repsMin ?? input.scheme.repsMax ?? 1,
      input.scheme.rirTarget ?? DEFAULT_LOGGED_RIR,
      input.loadKind,
    );
    if (start != null) {
      return {
        load: start,
        kind: "new_block",
        held: false,
        reason: `Suggested start for ${input.scheme.repsMin ?? ""}–${input.scheme.repsMax} reps from last block's best set. Edit if it feels off.`,
      };
    }
  }

  const earned = hitTopOfRange(working, input.scheme.repsMax);
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
  if (earned && !lock) {
    const next = nextLoad(lastLoad, input.loadKind) ?? lastLoad;
    return {
      load: next,
      kind: "increase",
      held: false,
      reason: `Every set hit ${input.scheme.repsMax} with ${PROGRESSION_MIN_RIR}+ in reserve: up to ${next}.`,
    };
  }
  return {
    load: lastLoad,
    kind: "same",
    held: earned,
    reason:
      earned && lock
        ? lock
        : "Same load: not every set reached the top of the range at RIR 2+.",
  };
}

export type LegExerciseInfo = {
  primaryMuscle: ProgramMuscle | null;
  measure: ProgramExercise["measure"];
};

export function programExerciseKey(name: string) {
  return name.trim().toLowerCase();
}

/** Program leg exercises by name (and their substitutes), for counting sets. */
export function legExerciseIndex(
  exercises: Pick<
    ProgramExercise,
    "name" | "primaryMuscle" | "measure" | "substituteName"
  >[],
): Map<string, LegExerciseInfo> {
  const index = new Map<string, LegExerciseInfo>();
  for (const ex of exercises) {
    const info = { primaryMuscle: ex.primaryMuscle, measure: ex.measure };
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
};

/**
 * Hard leg sets between two dates (inclusive): working, rep-based sets of a
 * program leg exercise at RIR 4 or less (blank RIR counts). A per-leg
 * exercise counts its left-leg sets only, so one L+R pair is one set.
 */
export function weeklyHardLegSets(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  index: Map<string, LegExerciseInfo>,
  range: { start: string; end: string },
): HardSetCount {
  const result: HardSetCount = { total: 0, byMuscle: {} };
  for (const session of sessions) {
    if (session.sessionDate < range.start || session.sessionDate > range.end) {
      continue;
    }
    for (const set of session.sets) {
      const info = index.get(programExerciseKey(set.exerciseName));
      if (!info || !info.primaryMuscle || info.measure !== "reps") continue;
      if (set.isWarmup || set.side === "right") continue;
      if (set.reps == null || set.reps <= 0) continue;
      if (set.rir != null && set.rir > HARD_SET_MAX_RIR) continue;
      result.total += 1;
      result.byMuscle[info.primaryMuscle] =
        (result.byMuscle[info.primaryMuscle] ?? 0) + 1;
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
