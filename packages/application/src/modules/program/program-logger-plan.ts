import type {
  ExerciseMeasure,
  KneeReadinessStatus,
  SideMode,
  StrengthSession,
  TrainingProgram,
} from "@fitness-app/domain";
import { KNEE_STATUS_COPY } from "./knee-readiness";
import type { ProgramWeekInfo } from "./program-calendar";
import {
  isPlannedToday,
  KNEE_OFF_BLOCK,
  prescribedRepsMaxOn,
  type PlannedExercise,
  type PlannedSession,
} from "./program-plan";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
} from "./program-settings";
import {
  FIND_LOAD_REASON,
  programExerciseKey,
  pullUpLoadCue,
  suggestHoldSeconds,
  suggestLoad,
  type LoadSuggestion,
  type ProgressionSet,
} from "./program-progression";

/** One exercise for the lift logger; the template shape plus program extras. */
export type LoggerPlanExercise = {
  exerciseName: string;
  exerciseOrder: number;
  targetSets: number;
  targetReps: number | null;
  targetWeight: number | null;
  targetRir: number | null;
  notes: string | null;
  sideMode?: SideMode;
  measure?: ExerciseMeasure;
  targetSeconds?: number | null;
  targetDistanceMeters?: number | null;
  /** Program leg work: the logger uses `targetWeight` as is. */
  program?: boolean;
  suggestion?: LoadSuggestion;
};

export type LoggerPlan = {
  name: string;
  notes: string | null;
  exercises: LoggerPlanExercise[];
};

export type ExerciseHistory = {
  sessionDate: string;
  sets: (ProgressionSet & { peakForceNewtons?: number | null })[];
};

/** For each exercise, every set from the newest session that has it. */
export function lastSetsByExercise(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
): Record<string, ExerciseHistory> {
  const result: Record<string, ExerciseHistory> = {};
  const newestFirst = [...sessions].sort((a, b) =>
    b.sessionDate.localeCompare(a.sessionDate),
  );
  for (const session of newestFirst) {
    const byKey = new Map<string, ExerciseHistory["sets"]>();
    for (const set of session.sets) {
      const key = programExerciseKey(set.exerciseName);
      byKey.set(key, [
        ...(byKey.get(key) ?? []),
        {
          weight: set.weight,
          reps: set.reps,
          rir: set.rir,
          isWarmup: set.isWarmup,
          side: set.side ?? null,
          durationSeconds: set.durationSeconds ?? null,
          peakForceNewtons: set.peakForceNewtons ?? null,
        },
      ]);
    }
    for (const [key, sets] of byKey) {
      if (!result[key])
        result[key] = { sessionDate: session.sessionDate, sets };
    }
  }
  return result;
}

function suggestionCue(s: LoadSuggestion) {
  if (s.load == null) return s.reason;
  const tag =
    s.kind === "increase"
      ? "Up"
      : s.kind === "new_block"
        ? "Suggested"
        : "Same";
  return `${tag}: ${s.load} lb. ${s.reason}`;
}

export type UpperTemplateExercise = Omit<
  LoggerPlanExercise,
  | "sideMode"
  | "measure"
  | "targetSeconds"
  | "targetDistanceMeters"
  | "program"
  | "suggestion"
>;

export type BuildLiftPlanInput = {
  program: TrainingProgram;
  planned: PlannedSession;
  info: ProgramWeekInfo;
  readiness: KneeReadinessStatus | null;
  history: Record<string, ExerciseHistory>;
  /** A linked upper-body template, run after the program rows unchanged. */
  upper: { notes: string | null; exercises: UpperTemplateExercise[] } | null;
  sleepAverageHours?: number | null;
  settings?: ProgramSettings;
};

/** "Per side." for per-side work (logged as one row per set). */
function sideNote(p: PlannedExercise) {
  return p.exercise.sideMode === "per_side" ? "Per side." : null;
}

/** Holds that progress by +5 s: not gait drills, balance or conditioning. */
function progressesByTime(p: PlannedExercise) {
  return (
    p.exercise.measure === "time" &&
    p.exercise.category !== "mobility" &&
    p.exercise.category !== "conditioning"
  );
}

function legExercise(
  p: PlannedExercise,
  input: BuildLiftPlanInput,
  settings: ProgramSettings,
): LoggerPlanExercise {
  const tempo = p.exercise.tempo ? `Tempo ${p.exercise.tempo}.` : null;
  const cue = p.exercise.cue;
  const base = {
    exerciseName: p.name,
    exerciseOrder: 0,
    targetSets: p.sets,
    targetRir: p.scheme.rirTarget,
    sideMode: p.exercise.sideMode,
    measure: p.exercise.measure,
    program: true as const,
  };
  const history = input.history[programExerciseKey(p.name)];
  if (p.exercise.measure === "distance") {
    return {
      ...base,
      targetReps: null,
      targetWeight: null,
      targetRir: null,
      targetSeconds: null,
      targetDistanceMeters: p.exercise.distanceMetersTarget,
      notes:
        [sideNote(p), cue, p.exercise.notes].filter(Boolean).join(" ") || null,
    };
  }
  if (p.exercise.measure !== "reps") {
    const hold = progressesByTime(p)
      ? suggestHoldSeconds({
          targetSeconds: p.exercise.secondsTarget,
          lastSets: history?.sets ?? [],
          readiness: input.readiness,
          isDeload: input.info.isDeload,
          sleepAverageHours: input.sleepAverageHours ?? null,
          settings,
        })
      : null;
    return {
      ...base,
      targetReps: null,
      targetWeight: null,
      targetRir: null,
      targetSeconds: hold?.seconds ?? p.exercise.secondsTarget,
      notes:
        [
          hold && hold.kind !== "start" ? hold.reason : null,
          sideNote(p),
          tempo,
          cue,
          p.exercise.notes,
        ]
          .filter(Boolean)
          .join(" ") || null,
    };
  }
  const suggestion = suggestLoad({
    loadKind: p.loadKind,
    scheme: p.scheme,
    lastSets: history?.sets ?? [],
    lastRepsMax: history
      ? prescribedRepsMaxOn(input.program, p.name, history.sessionDate)
      : null,
    readiness: input.readiness,
    isDeload: input.info.isDeload,
    sleepAverageHours: input.sleepAverageHours ?? null,
    settings,
  });
  return {
    ...base,
    targetReps: p.scheme.repsMax,
    targetWeight: suggestion.load,
    targetSeconds: null,
    suggestion,
    notes: [
      suggestionCue(suggestion),
      sideNote(p),
      tempo,
      cue,
      p.exercise.notes,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Upper rows run as logged: the logger prefills last time's load. A loaded
 * lift with no history says "Find load"; bodyweight pull-ups and chin-ups
 * say when to add load. Timed rows prefill seconds.
 */
function upperExercise(
  p: PlannedExercise,
  input: BuildLiftPlanInput,
  settings: ProgramSettings,
): LoggerPlanExercise {
  const { repsMin, repsMax } = p.scheme;
  const history = input.history[programExerciseKey(p.name)];
  const timed = p.exercise.measure === "time";
  const range =
    !timed && repsMin != null && repsMax != null && repsMin !== repsMax
      ? `${repsMin}-${repsMax} reps.`
      : null;
  const loaded = p.loadKind !== "bodyweight" && p.loadKind !== "band";
  const findLoad =
    !timed && loaded && (history?.sets.length ?? 0) === 0
      ? FIND_LOAD_REASON
      : null;
  const pullUp = pullUpLoadCue(p.name, history?.sets ?? [], settings);
  return {
    exerciseName: p.name,
    exerciseOrder: 0,
    targetSets: p.sets,
    targetReps: timed ? null : repsMax,
    targetWeight: null,
    targetRir: timed ? null : p.scheme.rirTarget,
    ...(timed
      ? { measure: "time" as const, targetSeconds: p.exercise.secondsTarget }
      : {}),
    notes:
      [findLoad, pullUp, range, sideNote(p), p.exercise.cue, p.exercise.notes]
        .filter(Boolean)
        .join(" ") || null,
  };
}

/**
 * Today's lift for the logger, in prescription order: leg work through the
 * progression engine, upper work prefilled from what was last logged. On a
 * knee day off every leg row is swapped for one ROM + walk block (upper
 * still runs). A linked upper template, if any, follows unchanged.
 */
export function buildLiftLoggerPlan(input: BuildLiftPlanInput): LoggerPlan {
  const { planned, info, readiness } = input;
  const settings = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
  const rows: LoggerPlanExercise[] = [];
  if (planned.legBlockReplaced) {
    rows.push({
      exerciseName: KNEE_OFF_BLOCK.name,
      exerciseOrder: 0,
      targetSets: 1,
      targetReps: null,
      targetWeight: null,
      targetRir: null,
      notes: `${KNEE_OFF_BLOCK.notes} ${settings.kneeOffBlockMinutes} min.`,
      measure: "time",
      targetSeconds: settings.kneeOffBlockMinutes * 60,
      sideMode: "bilateral",
      program: true,
    });
  }
  for (const p of planned.exercises.filter(isPlannedToday)) {
    if (p.part === "upper") rows.push(upperExercise(p, input, settings));
    else if (!planned.legBlockReplaced)
      rows.push(legExercise(p, input, settings));
  }
  const legs = rows;
  const upper = (input.upper?.exercises ?? []).map((ex) => ({ ...ex }));

  const status = readiness ? KNEE_STATUS_COPY[readiness] : null;
  const notes = [
    `Post-op week ${info.week}${info.block ? ` · ${info.block.name}` : ""}${
      info.isDeload ? " · Deload: one set fewer, no load increases." : "."
    }`,
    status ? `Knee check: ${status.label}. ${status.detail}` : null,
    settings.warmUp ? `Warm-up (8 min): ${settings.warmUp}.` : null,
    planned.session.notes,
    input.upper?.notes ?? null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    name: `${planned.session.name} · Wk ${info.week}`,
    notes,
    exercises: [...legs, ...upper].map((ex, i) => ({
      ...ex,
      exerciseOrder: i,
    })),
  };
}
