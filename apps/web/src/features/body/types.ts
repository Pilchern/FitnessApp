import type {
  BodyMetricSummary,
  SparseTrendPoint,
} from "@fitness-app/application";
import type { BodyMetric } from "@fitness-app/domain";

export type BodyPageData = {
  metrics: BodyMetric[];
  summary: BodyMetricSummary;
  weightTrend: SparseTrendPoint[];
  waistTrend: SparseTrendPoint[];
  bodyFatTrend: SparseTrendPoint[];
  editingMetric: BodyMetric | null;
  formError?: string;
};

export type BodyActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type BodyFormValues = {
  id?: string;
  measuredOn: string;
  weightLb: string;
  waistIn: string;
  bodyFatPct: string;
  muscleMassLb: string;
  sourceType: "manual";
  notes: string;
};
