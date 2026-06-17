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
  upsertMany(insights: UpsertInsightInput[]): Promise<PersistedInsight[]>;
  listActive(userId: string): Promise<PersistedInsight[]>;
  dismiss(id: string, userId: string): Promise<void>;
  archive(id: string, userId: string): Promise<void>;
}
