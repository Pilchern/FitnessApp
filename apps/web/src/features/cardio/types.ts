import type {
  CardioAdherenceSummary,
  CardioWeeklyTotals,
} from "@fitness-app/application";
import type { CardioSession, CardioSessionCompletion } from "@fitness-app/domain";

export type CardioTemplatePreset = {
  id: string;
  name: string;
  sessionKind: CardioSession["sessionKind"];
  targetDurationMinutes: number | null;
  intervalStructure: string | null;
  helperText: string | null;
};

export type CardioPageData = {
  templates: CardioTemplatePreset[];
  sessions: CardioSession[];
  weeklyTotals: CardioWeeklyTotals;
  adherence: CardioAdherenceSummary;
  editingSession: CardioSession | null;
  formError?: string;
};

export type CardioActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type CardioFormValues = {
  id?: string;
  trainingTemplateId: string;
  sessionDate: string;
  sessionKind: CardioSession["sessionKind"];
  plannedVsCompleted: CardioSessionCompletion;
  durationMinutes: string;
  avgHeartRate: string;
  maxHeartRate: string;
  avgOutput: string;
  cadenceMin: string;
  cadenceMax: string;
  resistanceMin: string;
  resistanceMax: string;
  intervalStructure: string;
  rpe: string;
  notes: string;
};
