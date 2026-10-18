export type InsightStatus = "active" | "dismissed" | "archived";
export type InsightSourceKind = "rule" | "ai";

export type PersistedInsight = {
  id: string;
  userId: string;
  insightDate: string;
  insightType: string;
  status: InsightStatus;
  title: string;
  body: string;
  evidence: Record<string, unknown>;
  sourceKind: InsightSourceKind;
  createdAt: string;
  updatedAt: string;
  dismissedAt: string | null;
  deletedAt: string | null;
};

export type UpsertInsightInput = {
  userId: string;
  insightType: string;
  title: string;
  body: string;
  evidence: Record<string, unknown>;
  sourceKind: InsightSourceKind;
  insightDate: string;
};

export interface InsightRepository {
  /**
   * Inserts new insights as active. For a (user, type, date) that already
   * exists and is still active, refreshes title, body and evidence. Never
   * changes status, dismissed_at or deleted_at, so a dismiss or archive sticks.
   */
  upsertMany(insights: UpsertInsightInput[]): Promise<PersistedInsight[]>;
  listActive(userId: string): Promise<PersistedInsight[]>;
  dismiss(id: string, userId: string): Promise<void>;
  archive(id: string, userId: string): Promise<void>;
  /**
   * Archives active rule insights whose condition no longer holds. Leaves
   * deleted_at null so a system retire stays distinguishable from a user
   * archive, and skips anything not active or not rule-sourced.
   */
  retireRuleInsights(ids: string[], userId: string): Promise<void>;
}
