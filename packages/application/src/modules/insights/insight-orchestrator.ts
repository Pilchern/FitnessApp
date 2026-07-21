import type { Insight } from "@fitness-app/domain";
import type { InsightEngineInput } from "./insight-rules";
import type { InsightRepository, PersistedInsight, UpsertInsightInput } from "./insight-repository";
import type { AiInsightService } from "./ai-insight-service";

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

export class InsightOrchestrator {
  constructor(
    private readonly repository: InsightRepository,
    private readonly aiService: AiInsightService | null,
    private readonly ruleEngine: (input: InsightEngineInput) => Insight[],
  ) {}

  async generateAndPersist(input: OrchestratorInput): Promise<PersistedInsight[]> {
    const { userId, ...engineInput } = input;

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

    let aiUpserts: UpsertInsightInput[] = [];
    if (this.aiService && (await this.isAiInsightStale(userId, input.now))) {
      const aiInsights = await this.aiService.generateInsights(engineInput);
      const today = new Date().toISOString().slice(0, 10);
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

    return this.repository.listActive(userId);
  }

  /**
   * Returns true when the user has no AI-sourced insight persisted within
   * the staleness window (or none at all), meaning it's OK to make a live
   * AI call. Reuses the existing listActive() query — no new repository
   * method or query shape is introduced for this check.
   */
  private async isAiInsightStale(userId: string, now?: Date): Promise<boolean> {
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

    const reference = now ?? new Date();
    const ageMs = reference.getTime() - new Date(mostRecentAiInsight.createdAt).getTime();
    return ageMs >= AI_INSIGHT_STALENESS_MS;
  }

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
