import type {
  MuscleGroupVolumeSummary,
  StrengthProgressionSummary,
} from "@fitness-app/application";
import type {
  ExerciseMuscleGroupOverride,
  StrengthSession,
  TrainingTemplate,
} from "@fitness-app/domain";

import type { StrengthProgramPlan } from "@/features/program/types";
import type { LastExercisePerformance } from "./helpers";

export type StrengthPageData = {
  sessions: StrengthSession[];
  progressionSummaries: StrengthProgressionSummary[];
  editingSession: StrengthSession | null;
  formError?: string;
  knownExercises: string[];
  lastSession: StrengthSession | null;
  strengthTemplates: TrainingTemplate[];
  muscleGroupVolume: MuscleGroupVolumeSummary;
  exerciseOverrides: ExerciseMuscleGroupOverride[];
  unclassifiedExerciseNames: string[];
  todaysScheduledTemplate: TrainingTemplate | null;
  /** Today's program lift (legs + upper), when the program has one. */
  programPlan: StrengthProgramPlan | null;
  lastByExercise: Record<string, LastExercisePerformance>;
  /** Newest `createdAt` across sessions; tells the logger its draft was saved. */
  latestCreatedAt: string | null;
};

export type StrengthDetailData = {
  session: StrengthSession | null;
  exerciseProgressionSummaries: StrengthProgressionSummary[];
};

export type StrengthActionState = {
  error?: string;
  /** Validation errors by field; the logger shows them in its error banner. */
  fieldErrors?: Record<string, string>;
};

export type StrengthSetFormValue = {
  exerciseName: string;
  setNumber: number;
  reps: string;
  weight: string;
  rir: string;
  isWarmup: boolean;
  durationSeconds: string;
  distanceMeters: string;
  /** Per-leg sets: which leg. Absent or "" on bilateral sets. */
  side?: "left" | "right" | "";
  /** Isometric sets: peak newtons. Present (even "") marks a force set. */
  peakForceNewtons?: string;
  notes: string;
  /** Local logging state; unticked sets are dropped on save once any is ticked. */
  done?: boolean;
};

export type StrengthFormValues = {
  id?: string;
  sessionDate: string;
  sessionName: string;
  notes: string;
  durationMinutes: string;
  readinessPre: string;
  energyPost: string;
  completedAsPlanned: boolean;
  /** The program session a program Start loaded; unset otherwise. */
  programSessionId?: string;
  sets: StrengthSetFormValue[];
};
