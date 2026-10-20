import type { Insight } from "@fitness-app/domain";
import type { InsightEngineInput } from "./insight-rules";
import type {
  InsightRepository,
  InsightRunState,
  PersistedInsight,
  UpsertInsightInput,
} from "./insight-repository";
import type { AiInsightService } from "./ai-insight-service";
import { getZonedDate } from "../../shared/timezone";

function insightKey(insightType: string, insightDate: string) {
  return `${insightType}:${insightDate}`;
}

export type OrchestratorInput = InsightEngineInput & {
  userId: string;
  recentJournalEntries?: string[];
};

// How long a persisted AI-sourced insight is considered "fresh" before
// another live AI call is allowed for that user. Without this gate,
// generateAndPersist() fired a real Claude API call on every single
// dashboard/insights page load — the single highest-impact finding from
// the performance audit. One hour comfortably covers repeated page loads
// within a session while still refreshing insights meaningfully often.
export const AI_INSIGHT_STALENESS_MS = 60 * 60 * 1000;

// A visit to /insights regenerates at most this often; between runs it shows
// the stored insights. The dashboard never generates (see getActive).
export const INSIGHT_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

// After a failed AI call, wait 1h, 2h, 4h ... up to 24h before trying again,
// so an outage or bad key costs one timed-out call per window, not one per load.
export const AI_FAILURE_BACKOFF_BASE_MS = 60 * 60 * 1000;
export const AI_FAILURE_BACKOFF_MAX_MS = 24 * 60 * 60 * 1000;

export function aiFailureBackoffMs(consecutiveFailures: number): number {
  const exponent = Math.max(0, consecutiveFailures - 1);
  return Math.min(
    AI_FAILURE_BACKOFF_BASE_MS * 2 ** exponent,
    AI_FAILURE_BACKOFF_MAX_MS,
  );
}

function ageMs(iso: string, now: Date): number {
  return now.getTime() - new Date(iso).getTime();
}

export class InsightOrchestrator {
  constructor(
    private readonly repository: InsightRepository,
    private readonly aiService: AiInsightService | null,
    private readonly ruleEngine: (input: InsightEngineInput) => Insight[],
  ) {}

  async generateAndPersist(
    input: OrchestratorInput,
  ): Promise<PersistedInsight[]> {
    const { userId, ...engineInput } = input;
    const now = input.now ?? new Date();

    const ruleInsights = this.ruleEngine(engineInput);
    const ruleUpserts: UpsertInsightInput[] = ruleInsights.map((insight) => ({
      userId,
      insightType: insight.insightType,
      title: insight.title,
      body: `${insight.explanation} ${insight.recommendedNextAction}`.trim(),
      evidence: { ...insight.evidence, severity: insight.severity },
      sourceKind: "rule",
      insightDate: insight.insightDate,
    }));

    const runState = await this.readRunState(userId);
    const nextRunState: InsightRunState = {
      lastRunAt: null,
      lastAiAttemptAt: runState?.lastAiAttemptAt ?? null,
      lastAiOutcome: runState?.lastAiOutcome ?? null,
      consecutiveAiFailures: runState?.consecutiveAiFailures ?? 0,
    };

    let aiUpserts: UpsertInsightInput[] = [];
    if (this.aiService && (await this.isAiCallDue(userId, runState, now))) {
      const result = await this.aiService.generate(engineInput);
      if (result.status !== "disabled") {
        const failed = result.status === "failed";
        nextRunState.lastAiAttemptAt = now.toISOString();
        nextRunState.lastAiOutcome = failed ? "failed" : "succeeded";
        nextRunState.consecutiveAiFailures = failed
          ? nextRunState.consecutiveAiFailures + 1
          : 0;
      }
      const aiInsights = result.status === "ok" ? result.insights : [];
      // The user's calendar date, not UTC's: an evening run in Chicago is
      // already tomorrow in UTC.
      const today = getZonedDate(input.timezone || "UTC", now)
        .toISOString()
        .slice(0, 10);
      aiUpserts = aiInsights.map((insight) => ({
        userId,
        insightType: insight.insightType,
        title: insight.title,
        body: insight.body,
        evidence: { severity: insight.severity },
        sourceKind: "ai",
        insightDate: today,
      }));
    }

    const allUpserts = [...ruleUpserts, ...aiUpserts];
    if (allUpserts.length > 0) {
      await this.repository.upsertMany(allUpserts);
    }

    // A rule insight is only true while its rule keeps firing. Retire active
    // rule insights this run did not produce, so a condition that has cleared
    // (sleep recovered, review completed) stops showing on the dashboard.
    // AI insights and anything the user dismissed are left alone.
    const firedRuleKeys = new Set(
      ruleUpserts.map((u) => insightKey(u.insightType, u.insightDate)),
    );
    const active = await this.repository.listActive(userId);
    const staleRuleIds = new Set(
      active
        .filter(
          (insight) =>
            insight.sourceKind === "rule" &&
            !firedRuleKeys.has(
              insightKey(insight.insightType, insight.insightDate),
            ),
        )
        .map((insight) => insight.id),
    );
    if (staleRuleIds.size > 0) {
      await this.repository.retireRuleInsights([...staleRuleIds], userId);
    }

    nextRunState.lastRunAt = now.toISOString();
    await this.writeRunState(userId, now, nextRunState);

    return active.filter((insight) => !staleRuleIds.has(insight.id));
  }

  /**
   * True when /insights should regenerate before rendering: no run recorded
   * yet, or the last one is at least INSIGHT_REFRESH_INTERVAL_MS old. One
   * small read, so the caller can skip loading six months of history when
   * nothing is due.
   */
  async isRefreshDue(userId: string, now: Date = new Date()): Promise<boolean> {
    const state = await this.readRunState(userId);
    if (!state?.lastRunAt) {
      return true;
    }
    return ageMs(state.lastRunAt, now) >= INSIGHT_REFRESH_INTERVAL_MS;
  }

  /**
   * Gate for a live AI call. A recorded attempt sets the wait: the staleness
   * window after a success, the backoff after failures. That holds even when
   * the user has archived every AI insight, which used to read as "none, call
   * again". Before any attempt is recorded, falls back to the age of the
   * newest active AI insight.
   */
  private async isAiCallDue(
    userId: string,
    runState: InsightRunState | null,
    now: Date,
  ): Promise<boolean> {
    if (runState?.lastAiAttemptAt) {
      const wait =
        runState.lastAiOutcome === "failed"
          ? aiFailureBackoffMs(runState.consecutiveAiFailures)
          : AI_INSIGHT_STALENESS_MS;
      return ageMs(runState.lastAiAttemptAt, now) >= wait;
    }
    return this.isAiInsightStale(userId, now);
  }

  /**
   * Returns true when the user has no AI-sourced insight persisted within
   * the staleness window (or none at all), meaning it's OK to make a live
   * AI call. Reuses the existing listActive() query — no new repository
   * method or query shape is introduced for this check.
   */
  private async isAiInsightStale(userId: string, now: Date): Promise<boolean> {
    const activeInsights = await this.repository.listActive(userId);
    const mostRecentAiInsight = activeInsights
      .filter((insight) => insight.sourceKind === "ai")
      .reduce<PersistedInsight | null>((latest, insight) => {
        if (!latest || insight.createdAt > latest.createdAt) {
          return insight;
        }
        return latest;
      }, null);

    if (!mostRecentAiInsight) {
      return true;
    }

    return ageMs(mostRecentAiInsight.createdAt, now) >= AI_INSIGHT_STALENESS_MS;
  }

  // Run state is bookkeeping: if it can't be read or written, generation
  // still runs and the gates fall back to their pre-run-state behaviour.
  private async readRunState(userId: string): Promise<InsightRunState | null> {
    try {
      return await this.repository.getRunState(userId);
    } catch (error) {
      console.error("[InsightOrchestrator] Failed to read run state:", error);
      return null;
    }
  }

  private async writeRunState(
    userId: string,
    now: Date,
    state: InsightRunState,
  ): Promise<void> {
    try {
      await this.repository.saveRunState(
        userId,
        now.toISOString().slice(0, 10),
        state,
      );
    } catch (error) {
      console.error("[InsightOrchestrator] Failed to save run state:", error);
    }
  }

  /** Read-only: no generation, no AI call, no writes. Used by the dashboard. */
  async getActive(userId: string): Promise<PersistedInsight[]> {
    return this.repository.listActive(userId);
  }

  async dismiss(id: string, userId: string): Promise<void> {
    return this.repository.dismiss(id, userId);
  }

  async archive(id: string, userId: string): Promise<void> {
    return this.repository.archive(id, userId);
  }
}
