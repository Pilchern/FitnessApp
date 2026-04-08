import type { EntityId, IsoDate } from "../../shared/ids";

export type InsightSeverity = "positive" | "info" | "caution" | "warning";

export type InsightType =
  | "cardio_sessions_below_target"
  | "repeated_missed_saturday"
  | "poor_recovery_trend"
  | "positive_waist_trend"
  | "alcohol_recovery_caution"
  | "missing_weekly_review"
  | "zone2_below_target"
  | "consecutive_strength_missed"
  | "sleep_below_target"
  | "alcohol_elevated"
  | "weight_trending_up"
  | "strong_week";

export type Insight = {
  id: EntityId;
  insightDate: IsoDate;
  insightType: InsightType;
  title: string;
  severity: InsightSeverity;
  explanation: string;
  recommendedNextAction: string;
  evidence: Record<string, unknown>;
  sourceKind: "rule";
};
