import type {
  MuscleGroupVolumeSummary,
  StrengthProgressionSummary,
} from "@fitness-app/application";
import type {
  ExerciseMuscleGroupOverride,
  StrengthSession,
  TrainingTemplate,
} from "@fitness-app/domain";

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
  lastByExercise: Record<string, LastExercisePerformance>;
};

export type StrengthDetailData = {
  session: StrengthSession | null;
  exerciseProgressionSummaries: StrengthProgressionSummary[];
};

export type StrengthActionState = {
  error?: string;
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
  sets: StrengthSetFormValue[];
};
