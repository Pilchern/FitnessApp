import type {
  RecoverySummary,
  SparseTrendPoint,
} from "@fitness-app/application";
import type { RecoveryCheckin, Supplement } from "@fitness-app/domain";

export type RecoveryPageData = {
  checkins: RecoveryCheckin[];
  summary: RecoverySummary;
  sleepTrend: SparseTrendPoint[];
  restingHeartRateTrend: SparseTrendPoint[];
  hrvTrend: SparseTrendPoint[];
  editingCheckin: RecoveryCheckin | null;
  formError?: string;
  activeSupplements: Supplement[];
  supplementsTakenToday: string[];
  todayIsoDate: string;
};

export type RecoveryActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type SupplementChecklistActionState = {
  error?: string;
};

export type RecoveryFormValues = {
  id?: string;
  checkinDate: string;
  sleepHours: string;
  bedtimeLocal: string;
  wakeTimeLocal: string;
  sleepQuality: string;
  readinessLevel: string;
  energyLevel: string;
  stressLevel: string;
  sorenessLevel: string;
  alcoholCount: string;
  restingHeartRate: string;
  hrv: string;
  coldPlungeCompleted: boolean;
  notes: string;
};
