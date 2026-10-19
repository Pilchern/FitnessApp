import type {
  ExerciseMeasure,
  ProgramExerciseCategory,
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
import { restAfterSet, type BudgetItem, type RestCall } from "./session-budget";
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
  /** Program work: the logger uses `targetWeight` as is. */
  program?: boolean;
  suggestion?: LoadSuggestion;
  /** Superset letter and position ("A", 1); null = straight sets. */
  supersetGroup?: string | null;
  supersetOrder?: number | null;
  category?: ProgramExerciseCategory | null;
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

function programRow(
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
    supersetGroup: p.exercise.supersetGroup ?? null,
    supersetOrder: p.exercise.supersetOrder ?? null,
    category: p.exercise.category ?? null,
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
    repLadder: repLadder(input.program),
    readiness: input.readiness,
    isDeload: input.info.isDeload,
    sleepAverageHours: input.sleepAverageHours ?? null,
    settings,
  });
  const pullUp = pullUpLoadCue(p.name, history?.sets ?? [], settings);
  const { repsMin, repsMax } = p.scheme;
  const range =
    repsMin != null && repsMax != null && repsMin !== repsMax
      ? `${repsMin}-${repsMax} reps.`
      : null;
  return {
    ...base,
    targetReps: p.scheme.repsMax,
    targetWeight: suggestion.load,
    targetSeconds: null,
    suggestion,
    notes: [
      suggestionCue(suggestion),
      pullUp,
      range,
      sideNote(p),
      tempo,
      cue,
      p.exercise.notes,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/** Rep tops of every block, for counting steps between rep ranges. */
function repLadder(program: TrainingProgram) {
  return program.blocks
    .map((b) => b.repsMax)
    .filter((v): v is number => v != null);
}

/**
 * Today's lift for the logger, in prescription order (supersets keep their
 * letters): every row through the progression engine. On a knee day off
 * every leg row is swapped for one ROM + walk block (upper still runs, its
 * superset partners now straight sets). A linked upper template, if any,
 * follows unchanged.
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
    if (p.part === "legs" && planned.legBlockReplaced) continue;
    rows.push(programRow(p, input, settings));
  }
  const legs = rows;
  const upper = (input.upper?.exercises ?? []).map((ex) => ({ ...ex }));

  const status = readiness ? KNEE_STATUS_COPY[readiness] : null;
  const notes = [
    `Post-op week ${info.week}${info.block ? ` · ${info.block.name}` : ""}${
      info.isDeload ? " · Deload: one set fewer, no load increases." : "."
    }`,
    status ? `Knee check: ${status.label}. ${status.detail}` : null,
    settings.warmUp
      ? `Warm-up (${settings.sessionWarmUpMinutes} min): ${settings.warmUp}.`
      : null,
    settings.gaitDrill
      ? `Gait drill (${settings.sessionGaitDrillMinutes} min): ${settings.gaitDrill}`
      : null,
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

/** Program rows' rest rules by exercise key; other rows keep the manual timer. */
export type RestMeta = Record<string, BudgetItem>;

export function restMetaFromPlan(exercises: LoggerPlanExercise[]): RestMeta {
  return Object.fromEntries(
    exercises
      .filter((ex) => ex.program)
      .map((ex): [string, BudgetItem] => [
        programExerciseKey(ex.exerciseName),
        {
          name: ex.exerciseName,
          sets: ex.targetSets,
          measure: ex.measure ?? "reps",
          sideMode: ex.sideMode ?? "bilateral",
          category: ex.category ?? null,
          secondsTarget: ex.targetSeconds ?? null,
          supersetGroup: ex.supersetGroup ?? null,
          supersetOrder: ex.supersetOrder ?? null,
        },
      ]),
  );
}

/**
 * Rest after ticking set `index` in the logger (sets as they were before
 * the tick), or null for a row with no program rest rule. Superset partners
 * count only while they still have an unticked set, so the last round of an
 * uneven pair rests like a straight set.
 */
export function restForTick(
  sets: { exerciseName: string; side?: string | null; done?: boolean }[],
  index: number,
  meta: RestMeta,
): RestCall | null {
  const set = sets[index];
  if (!set) return null;
  const item = meta[programExerciseKey(set.exerciseName)];
  if (!item) return null;
  const side = set.side === "left" || set.side === "right" ? set.side : null;
  const hasOpenSet = (name: string) =>
    sets.some(
      (s, i) =>
        i !== index &&
        !s.done &&
        programExerciseKey(s.exerciseName) === programExerciseKey(name),
    );
  const group = item.supersetGroup
    ? Object.values(meta).filter(
        (m) =>
          m.supersetGroup === item.supersetGroup &&
          (m.name === item.name || hasOpenSet(m.name)),
      )
    : [item];
  return restAfterSet({ item, side, group });
}
