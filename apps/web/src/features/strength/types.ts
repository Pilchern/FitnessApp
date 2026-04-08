import type {
  StrengthProgressionSummary,
} from "@fitness-app/application";
import type { StrengthSession, TrainingTemplate } from "@fitness-app/domain";

export type StrengthPageData = {
  sessions: StrengthSession[];
  progressionSummaries: StrengthProgressionSummary[];
  editingSession: StrengthSession | null;
  formError?: string;
  knownExercises: string[];
  lastSession: StrengthSession | null;
  strengthTemplates: TrainingTemplate[];
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
  notes: string;
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
