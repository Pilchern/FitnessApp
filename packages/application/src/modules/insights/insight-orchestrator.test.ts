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

  async retireRuleInsights(): Promise<void> {}
}

/**
 * Keeps rows in memory and follows the repository contract: inserts new keys
 * as active, refreshes the content of an existing active row, and never
 * touches status on conflict.
 */
class InMemoryInsightRepository implements InsightRepository {
  public rows: PersistedInsight[] = [];
  public retiredIds: string[] = [];
  private nextId = 1;

  async upsertMany(
    insights: UpsertInsightInput[],
  ): Promise<PersistedInsight[]> {
    return insights.map((input) => {
      const existing = this.rows.find(
        (row) =>
          row.userId === input.userId &&
          row.insightType === input.insightType &&
          row.insightDate === input.insightDate,
      );
      if (existing) {
        if (existing.status === "active") {
          existing.title = input.title;
          existing.body = input.body;
          existing.evidence = input.evidence;
        }
        return existing;
      }
      const row = makePersistedInsight({
        id: `row-${this.nextId++}`,
        userId: input.userId,
        insightType: input.insightType,
        insightDate: input.insightDate,
        title: input.title,
        body: input.body,
        evidence: input.evidence,
        sourceKind: input.sourceKind,
      });
      this.rows.push(row);
      return row;
    });
  }

  async listActive(userId: string): Promise<PersistedInsight[]> {
    return this.rows.filter(
      (row) => row.userId === userId && row.status === "active",
    );
  }

  async dismiss(): Promise<void> {}

  async archive(): Promise<void> {}

  async retireRuleInsights(ids: string[], userId: string): Promise<void> {
    for (const row of this.rows) {
      if (
        ids.includes(row.id) &&
        row.userId === userId &&
        row.status === "active" &&
        row.sourceKind === "rule"
      ) {
        row.status = "archived";
        this.retiredIds.push(row.id);
      }
    }
  }
}

function makeRuleInsight(
  insightType: Insight["insightType"],
  insightDate: string,
  explanation: string,
): Insight {
  return {
    id: `${insightType}:${insightDate}`,
    insightType,
    insightDate,
    title: "Rule title",
    explanation,
    recommendedNextAction: "Next action.",
    severity: "caution",
    evidence: { note: explanation },
    sourceKind: "rule",
  };
}

describe("InsightOrchestrator.generateAndPersist — rule insight freshness", () => {
  it("retires rule insights that stopped firing and refreshes the text of ones that still fire", async () => {
    const repository = new InMemoryInsightRepository();
    repository.rows = [
      makePersistedInsight({
        id: "recovery",
        insightType: "poor_recovery_trend",
        insightDate: "2026-10-15",
        body: "Old recovery text.",
      }),
      makePersistedInsight({
        id: "sleep",
        insightType: "sleep_below_target",
        insightDate: "2026-10-05",
        body: "Average sleep was 6.1h. Next action.",
      }),
      makePersistedInsight({
        id: "ai",
        insightType: "trend",
        insightDate: "2026-10-14",
        sourceKind: "ai",
        createdAt: "2026-10-18T11:30:00.000Z",
      }),
      makePersistedInsight({
        id: "dismissed",
        insightType: "missing_weekly_review",
        insightDate: "2026-10-05",
        status: "dismissed",
        dismissedAt: "2026-10-13T12:00:00.000Z",
      }),
    ];

    // This run, sleep still fires with new numbers; recovery has cleared.
    let ruleOutput = [
      makeRuleInsight(
        "sleep_below_target",
        "2026-10-05",
        "Average sleep was 6.4h.",
      ),
    ];
    const orchestrator = new InsightOrchestrator(
      repository,
      makeAiService(),
      () => ruleOutput,
    );

    const result = await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: new Date("2026-10-18T12:00:00.000Z"),
    });

    expect(result.map((i) => i.id).sort()).toEqual(["ai", "sleep"]);
    expect(result.find((i) => i.id === "sleep")?.body).toBe(
      "Average sleep was 6.4h. Next action.",
    );
    expect(repository.retiredIds).toEqual(["recovery"]);
    expect(repository.rows.find((r) => r.id === "recovery")?.status).toBe(
      "archived",
    );
    // The AI insight and the user's dismissal are untouched.
    expect(repository.rows.find((r) => r.id === "ai")?.status).toBe("active");
    expect(repository.rows.find((r) => r.id === "dismissed")?.status).toBe(
      "dismissed",
    );

    // A dismissed rule insight that fires again stays dismissed.
    ruleOutput = [
      makeRuleInsight("missing_weekly_review", "2026-10-05", "Still missing."),
    ];
    const second = await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: new Date("2026-10-18T12:05:00.000Z"),
    });
    expect(second.map((i) => i.id)).toEqual(["ai"]);
    expect(repository.rows.find((r) => r.id === "dismissed")?.status).toBe(
      "dismissed",
    );
  });

  it("stamps AI insights with the user's calendar date, not UTC's", async () => {
    const repository = new InMemoryInsightRepository();
    const aiService = makeAiService([
      { insightType: "trend", title: "Title", body: "Body", severity: "info" },
    ]);
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    // Sunday 2026-10-18 20:00 in Chicago is Monday 01:00 UTC.
    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: new Date("2026-10-19T01:00:00.000Z"),
      timezone: "America/Chicago",
    });

    expect(repository.rows[0]?.insightDate).toBe("2026-10-18");
  });
});

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
