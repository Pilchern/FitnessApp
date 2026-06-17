import type { Insight } from "@fitness-app/domain";
import type { InsightEngineInput } from "./insight-rules";
import type { InsightRepository, PersistedInsight, UpsertInsightInput } from "./insight-repository";
import type { AiInsightService } from "./ai-insight-service";

export type OrchestratorInput = InsightEngineInput & {
  userId: string;
  recentJournalEntries?: string[];
};

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
    if (this.aiService) {
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
