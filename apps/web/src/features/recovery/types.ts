import type {
  RecoverySummary,
  SparseTrendPoint,
} from "@fitness-app/application";
import type { RecoveryCheckin } from "@fitness-app/domain";

export type RecoveryPageData = {
  checkins: RecoveryCheckin[];
  summary: RecoverySummary;
  sleepTrend: SparseTrendPoint[];
  restingHeartRateTrend: SparseTrendPoint[];
  hrvTrend: SparseTrendPoint[];
  editingCheckin: RecoveryCheckin | null;
  formError?: string;
};

export type RecoveryActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type RecoveryFormValues = {
  id?: string;
  checkinDate: string;
  sleepHours: string;
  sleepQuality: string;
  readinessLevel: string;
  energyLevel: string;
  stressLevel: string;
  sorenessLevel: string;
  alcoholCount: string;
  restingHeartRate: string;
  hrv: string;
  notes: string;
};
