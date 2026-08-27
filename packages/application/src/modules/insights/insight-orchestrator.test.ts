import { describe, expect, it, vi } from "vitest";
import type { Insight } from "@fitness-app/domain";
import type { AiInsightService, GeneratedInsight } from "./ai-insight-service";
import type { InsightEngineInput } from "./insight-rules";
import type {
  InsightRepository,
  PersistedInsight,
  UpsertInsightInput,
} from "./insight-repository";
import {
  AI_INSIGHT_STALENESS_MS,
  InsightOrchestrator,
} from "./insight-orchestrator";

const userId = "11111111-1111-4111-8111-111111111111";

const baseEngineInput: InsightEngineInput = {
  bodyMetrics: [],
  cardioSessions: [],
  recoveryCheckins: [],
  weeklyReviews: [],
  strengthSessions: [],
  liftsCompletedByWeek: {},
};

function makePersistedInsight(
  overrides: Partial<PersistedInsight> = {},
): PersistedInsight {
  return {
    id: "insight-1",
    userId,
    insightDate: "2026-07-10",
    insightType: "test_insight",
    status: "active",
    title: "Test insight",
    body: "Test body",
    evidence: {},
    sourceKind: "rule",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    dismissedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

class FakeInsightRepository implements InsightRepository {
  public activeInsights: PersistedInsight[] = [];
  public upsertCalls: UpsertInsightInput[][] = [];

  async upsertMany(
    insights: UpsertInsightInput[],
  ): Promise<PersistedInsight[]> {
    this.upsertCalls.push(insights);
    return insights.map((i) =>
      makePersistedInsight({
        insightType: i.insightType,
        sourceKind: i.sourceKind,
      }),
    );
  }

  async listActive(): Promise<PersistedInsight[]> {
    return this.activeInsights;
  }

  async dismiss(): Promise<void> {}

  async archive(): Promise<void> {}
}

function noRuleInsights(): Insight[] {
  return [];
}

function makeAiService(insights: GeneratedInsight[] = []): AiInsightService {
  return {
    generateInsights: vi.fn().mockResolvedValue(insights),
  } as unknown as AiInsightService;
}

describe("InsightOrchestrator.generateAndPersist — AI staleness gate", () => {
  it("calls the AI service when no AI insight has ever been persisted", async () => {
    const repository = new FakeInsightRepository();
    const aiService = makeAiService([
      { insightType: "trend", title: "Title", body: "Body", severity: "info" },
    ]);
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: new Date("2026-07-16T12:00:00.000Z"),
    });

    expect(aiService.generateInsights).toHaveBeenCalledTimes(1);
    expect(repository.upsertCalls[0]?.some((u) => u.sourceKind === "ai")).toBe(
      true,
    );
  });

  it("does NOT call the AI service when a recent (< 1hr old) AI insight already exists", async () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const repository = new FakeInsightRepository();
    repository.activeInsights = [
      makePersistedInsight({
        sourceKind: "ai",
        createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
      }),
    ];
    const aiService = makeAiService();
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    await orchestrator.generateAndPersist({ ...baseEngineInput, userId, now });

    expect(aiService.generateInsights).not.toHaveBeenCalled();
    expect(repository.upsertCalls).toHaveLength(0);
  });

  it("calls the AI service again once the most recent AI insight is stale (>= 1hr old)", async () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const repository = new FakeInsightRepository();
    repository.activeInsights = [
      makePersistedInsight({
        sourceKind: "ai",
        createdAt: new Date(
          now.getTime() - AI_INSIGHT_STALENESS_MS - 1000,
        ).toISOString(),
      }),
    ];
    const aiService = makeAiService([
      { insightType: "trend", title: "Title", body: "Body", severity: "info" },
    ]);
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    await orchestrator.generateAndPersist({ ...baseEngineInput, userId, now });

    expect(aiService.generateInsights).toHaveBeenCalledTimes(1);
  });

  it("ignores non-AI (rule) insights when determining staleness", async () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const repository = new FakeInsightRepository();
    repository.activeInsights = [
      makePersistedInsight({
        sourceKind: "rule",
        createdAt: now.toISOString(),
      }),
    ];
    const aiService = makeAiService([
      { insightType: "trend", title: "Title", body: "Body", severity: "info" },
    ]);
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    await orchestrator.generateAndPersist({ ...baseEngineInput, userId, now });

    // Only a rule insight exists (however fresh) — that must not block the AI call.
    expect(aiService.generateInsights).toHaveBeenCalledTimes(1);
  });

  it("never calls the AI service when none is configured (aiService: null)", async () => {
    const repository = new FakeInsightRepository();
    const orchestrator = new InsightOrchestrator(
      repository,
      null,
      noRuleInsights,
    );

    const result = await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
    });

    expect(result).toEqual([]);
  });

  it("still persists rule-based insights even when the AI call is skipped as stale", async () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const repository = new FakeInsightRepository();
    repository.activeInsights = [
      makePersistedInsight({ sourceKind: "ai", createdAt: now.toISOString() }),
    ];
    const aiService = makeAiService();
    const insight: Insight = {
      id: "rule-insight-1",
      insightType: "poor_recovery_trend",
      title: "HRV trending down",
      explanation: "Your HRV has dropped.",
      recommendedNextAction: "Prioritize sleep this week.",
      severity: "warning",
      evidence: {},
      insightDate: "2026-07-16",
      sourceKind: "rule",
    };
    const orchestrator = new InsightOrchestrator(repository, aiService, () => [
      insight,
    ]);

    await orchestrator.generateAndPersist({ ...baseEngineInput, userId, now });

    expect(aiService.generateInsights).not.toHaveBeenCalled();
    expect(repository.upsertCalls[0]).toHaveLength(1);
    expect(repository.upsertCalls[0]?.[0]?.sourceKind).toBe("rule");
  });
});
