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
  type PlannedSession,
} from "./program-plan";
import {
  programExerciseKey,
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
  "sideMode" | "measure" | "targetSeconds" | "program" | "suggestion"
>;

export type BuildLiftPlanInput = {
  program: TrainingProgram;
  planned: PlannedSession;
  info: ProgramWeekInfo;
  readiness: KneeReadinessStatus | null;
  history: Record<string, ExerciseHistory>;
  upper: { notes: string | null; exercises: UpperTemplateExercise[] } | null;
};

/**
 * Today's lift for the logger: the leg block first (or ROM + walk on a knee
 * day off), then the linked upper-body template unchanged. Leg loads come
 * from the progression engine; upper loads stay with the logger's
 * last-logged prefill.
 */
export function buildLiftLoggerPlan(input: BuildLiftPlanInput): LoggerPlan {
  const { planned, info, readiness } = input;
  const legs: LoggerPlanExercise[] = planned.legBlockReplaced
    ? [
        {
          exerciseName: KNEE_OFF_BLOCK.name,
          exerciseOrder: 0,
          targetSets: 1,
          targetReps: null,
          targetWeight: null,
          targetRir: null,
          notes: KNEE_OFF_BLOCK.notes,
          measure: "time",
          targetSeconds: KNEE_OFF_BLOCK.seconds,
          sideMode: "bilateral",
          program: true,
        },
      ]
    : planned.exercises.filter(isPlannedToday).map((p, i) => {
        const tempo = p.exercise.tempo ? `Tempo ${p.exercise.tempo}.` : null;
        const base = {
          exerciseName: p.name,
          exerciseOrder: i,
          targetSets: p.sets,
          targetRir: p.scheme.rirTarget,
          sideMode: p.exercise.sideMode,
          measure: p.exercise.measure,
          program: true as const,
        };
        if (p.exercise.measure !== "reps") {
          return {
            ...base,
            targetReps: null,
            targetWeight: null,
            targetRir: null,
            targetSeconds: p.exercise.secondsTarget,
            notes: [tempo, p.exercise.notes].filter(Boolean).join(" ") || null,
          };
        }
        const history = input.history[programExerciseKey(p.name)];
        const suggestion = suggestLoad({
          loadKind: p.loadKind,
          scheme: p.scheme,
          lastSets: history?.sets ?? [],
          lastRepsMax: history
            ? prescribedRepsMaxOn(input.program, p.name, history.sessionDate)
            : null,
          readiness,
          isDeload: info.isDeload,
        });
        return {
          ...base,
          targetReps: p.scheme.repsMax,
          targetWeight: suggestion.load,
          targetSeconds: null,
          suggestion,
          notes: [suggestionCue(suggestion), tempo, p.exercise.notes]
            .filter(Boolean)
            .join(" "),
        };
      });

  const upper = (input.upper?.exercises ?? []).map((ex, i) => ({
    ...ex,
    exerciseOrder: legs.length + i,
  }));

  const status = readiness ? KNEE_STATUS_COPY[readiness] : null;
  const notes = [
    `Post-op week ${info.week}${info.block ? ` · ${info.block.name}` : ""}${
      info.isDeload ? " · Deload: one set fewer, no load increases." : "."
    }`,
    status ? `Knee check: ${status.label}. ${status.detail}` : null,
    planned.session.notes,
    input.upper?.notes ?? null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    name: `${planned.session.name} · Wk ${info.week}`,
    notes,
    exercises: [...legs, ...upper],
  };
}
