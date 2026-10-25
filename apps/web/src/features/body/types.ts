import type {
  BodyMetricSummary,
  SparseTrendPoint,
  WeeklyWeightTrend,
} from "@fitness-app/application";
import type { BodyMetric } from "@fitness-app/domain";

export type BodyPageData = {
  metrics: BodyMetric[];
  summary: BodyMetricSummary;
  weeklyWeight: WeeklyWeightTrend;
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
  waistIn: string;
  waistHipIn: string;
  waistGutIn: string;
  sourceType: "manual";
  notes: string;
};
