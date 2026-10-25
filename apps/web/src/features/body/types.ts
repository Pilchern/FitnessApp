import type {
  AdjustedBodyFat,
  BodyMetricSummary,
  SparseTrendPoint,
  WeeklyWeightTrend,
} from "@fitness-app/application";
import type { BodyMetric, DexaScan } from "@fitness-app/domain";

export type BodyPageData = {
  metrics: BodyMetric[];
  latestDexa: DexaScan | null;
  /** Withings 7-day average + the latest DEXA offset; an estimate. */
  adjustedBodyFat: AdjustedBodyFat | null;
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
