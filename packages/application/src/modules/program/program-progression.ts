import type {
  IsoDate,
  KneeReadinessStatus,
  LoadKind,
  ProgramBlock,
  ProgramExercise,
  ProgramMuscle,
  StrengthSession,
} from "@fitness-app/domain";
import { addDays } from "./program-calendar";
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
>;

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
 * Starting load for a new rep range from last block's best working set:
 * the load that leaves `targetRir` in reserve at `targetReps`, rounded down.
 * 100 lb x 10 at RIR 2 gives 110 lb for 6 reps at RIR 2 (about x1.1).
 */
export function newBlockStartLoad(
  sets: ProgressionSet[],
  targetReps: number,
  targetRir: number,
  kind: LoadKind,
  steps: LoadSteps = DEFAULT_PROGRAM_SETTINGS,
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
  return roundDownToLoadStep(raw, kind, steps);
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
  /** Average sleep over the last few nights; null when there is no data. */
  sleepAverageHours?: number | null;
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
 * Next session's load. Increases only on a normal knee check, outside a
 * deload, and when recent sleep averages at least the setting (6.5 h); a
 * changed rep range (new block) starts from last block's best set.
 */
export function suggestLoad(input: SuggestLoadInput): LoadSuggestion {
  const settings = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
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
        : input.sleepAverageHours != null &&
            input.sleepAverageHours < settings.sleepMinHoursForIncrease
          ? `Sleep averaged ${input.sleepAverageHours.toFixed(1)} h over ${settings.sleepAverageNights} nights (under ${settings.sleepMinHoursForIncrease}): no load increase.`
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
      settings,
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

  const earned = hitTopOfRange(
    working,
    input.scheme.repsMax,
    settings.progressionMinRir,
  );
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
    const next = nextLoad(lastLoad, input.loadKind, settings) ?? lastLoad;
    return {
      load: next,
      kind: "increase",
      held: false,
      reason: `Every set hit ${input.scheme.repsMax} with ${settings.progressionMinRir}+ in reserve: up to ${next}.`,
    };
  }
  return {
    load: lastLoad,
    kind: "same",
    held: earned,
    reason:
      earned && lock
        ? lock
        : `Same load: not every set reached the top of the range at RIR ${settings.progressionMinRir}+.`,
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
 * program leg exercise at the hard-set RIR or less (4; blank RIR counts). A per-leg
 * exercise counts its left-leg sets only, so one L+R pair is one set.
 */
export function weeklyHardLegSets(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  index: Map<string, LegExerciseInfo>,
  range: { start: string; end: string },
  hardSetMaxRir: number = DEFAULT_PROGRAM_SETTINGS.hardSetMaxRir,
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
      if (set.rir != null && set.rir > hardSetMaxRir) continue;
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
