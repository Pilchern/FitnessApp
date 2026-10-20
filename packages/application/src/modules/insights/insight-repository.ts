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

/**
 * Bookkeeping for insight generation, kept so a page visit can tell whether a
 * refresh is due and a failing AI call backs off instead of retrying on every
 * load. Stored without a migration as a non-active `insights` row of type
 * INSIGHT_RUN_STATE_TYPE (see the Supabase repository), so no screen shows it.
 */
export type InsightRunState = {
  /** When generateAndPersist last finished. */
  lastRunAt: string | null;
  /** When the AI service was last called, whatever the outcome. */
  lastAiAttemptAt: string | null;
  lastAiOutcome: "succeeded" | "failed" | null;
  consecutiveAiFailures: number;
};

export const INSIGHT_RUN_STATE_TYPE = "insight_run_state";

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
  /** The user's latest run state, or null before the first recorded run. */
  getRunState(userId: string): Promise<InsightRunState | null>;
  /** Records run state, one row per user per runDate (YYYY-MM-DD). */
  saveRunState(
    userId: string,
    runDate: string,
    state: InsightRunState,
  ): Promise<void>;
}
