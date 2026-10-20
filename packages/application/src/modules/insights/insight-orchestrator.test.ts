import { describe, expect, it, vi } from "vitest";
import type { Insight } from "@fitness-app/domain";
import type { AiInsightService, GeneratedInsight } from "./ai-insight-service";
import type { InsightEngineInput } from "./insight-rules";
import type {
  InsightRepository,
  InsightRunState,
  PersistedInsight,
  UpsertInsightInput,
} from "./insight-repository";
import {
  AI_INSIGHT_STALENESS_MS,
  INSIGHT_REFRESH_INTERVAL_MS,
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

  async getRunState(): Promise<InsightRunState | null> {
    return null;
  }

  async saveRunState(): Promise<void> {}
}

/**
 * Keeps rows in memory and follows the repository contract: inserts new keys
 * as active, refreshes the content of an existing active row, and never
 * touches status on conflict.
 */
class InMemoryInsightRepository implements InsightRepository {
  public rows: PersistedInsight[] = [];
  public retiredIds: string[] = [];
  public runState: InsightRunState | null = null;
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

  async getRunState(): Promise<InsightRunState | null> {
    return this.runState;
  }

  async saveRunState(_userId: string, state: InsightRunState): Promise<void> {
    this.runState = state;
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
    generate: vi.fn().mockResolvedValue({ status: "ok", insights }),
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

    expect(aiService.generate).toHaveBeenCalledTimes(1);
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

    expect(aiService.generate).not.toHaveBeenCalled();
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

    expect(aiService.generate).toHaveBeenCalledTimes(1);
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
    expect(aiService.generate).toHaveBeenCalledTimes(1);
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

    expect(aiService.generate).not.toHaveBeenCalled();
    expect(repository.upsertCalls[0]).toHaveLength(1);
    expect(repository.upsertCalls[0]?.[0]?.sourceKind).toBe("rule");
  });
});

describe("InsightOrchestrator.getActive — dashboard read path", () => {
  it("reads active insights and never writes, generates or calls the AI", async () => {
    const repository = new InMemoryInsightRepository();
    repository.rows = [makePersistedInsight({ id: "a" })];
    const upsert = vi.spyOn(repository, "upsertMany");
    const retire = vi.spyOn(repository, "retireRuleInsights");
    const save = vi.spyOn(repository, "saveRunState");
    const ruleEngine = vi.fn(noRuleInsights);
    const aiService = makeAiService();
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      ruleEngine,
    );

    const result = await orchestrator.getActive(userId);

    expect(result.map((i) => i.id)).toEqual(["a"]);
    expect(upsert).not.toHaveBeenCalled();
    expect(retire).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(ruleEngine).not.toHaveBeenCalled();
    expect(aiService.generate).not.toHaveBeenCalled();
  });
});

describe("InsightOrchestrator.isRefreshDue — /insights staleness guard", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");
  const minutesAgo = (m: number) =>
    new Date(now.getTime() - m * 60 * 1000).toISOString();

  it("is due before any run has been recorded", async () => {
    const orchestrator = new InsightOrchestrator(
      new InMemoryInsightRepository(),
      null,
      noRuleInsights,
    );
    expect(await orchestrator.isRefreshDue(userId, now)).toBe(true);
  });

  it("is not due inside the interval and due once it has passed", async () => {
    const repository = new InMemoryInsightRepository();
    const orchestrator = new InsightOrchestrator(
      repository,
      null,
      noRuleInsights,
    );

    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: new Date(minutesAgo(30)),
    });
    expect(repository.runState?.lastRunAt).toBe(minutesAgo(30));
    expect(await orchestrator.isRefreshDue(userId, now)).toBe(false);

    const later = new Date(
      new Date(minutesAgo(30)).getTime() + INSIGHT_REFRESH_INTERVAL_MS,
    );
    expect(await orchestrator.isRefreshDue(userId, later)).toBe(true);
  });

  it("treats an unreadable run state as due rather than failing the page", async () => {
    const repository = new InMemoryInsightRepository();
    vi.spyOn(repository, "getRunState").mockRejectedValue(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const orchestrator = new InsightOrchestrator(
      repository,
      null,
      noRuleInsights,
    );
    expect(await orchestrator.isRefreshDue(userId, now)).toBe(true);
    errorSpy.mockRestore();
  });
});

describe("InsightOrchestrator.generateAndPersist — AI failure backoff", () => {
  const start = new Date("2026-10-20T12:00:00.000Z");
  const at = (minutes: number) =>
    new Date(start.getTime() + minutes * 60 * 1000);
  const insight: GeneratedInsight = {
    insightType: "trend",
    title: "Title",
    body: "Body",
    severity: "info",
  };

  it("records a failure and waits out the backoff instead of retrying every run", async () => {
    const repository = new InMemoryInsightRepository();
    const aiService = {
      generate: vi
        .fn()
        .mockResolvedValue({ status: "failed", reason: "timeout" }),
    } as unknown as AiInsightService;
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );
    const run = (now: Date) =>
      orchestrator.generateAndPersist({ ...baseEngineInput, userId, now });

    await run(start);
    expect(aiService.generate).toHaveBeenCalledTimes(1);
    expect(repository.runState).toMatchObject({
      lastAiOutcome: "failed",
      consecutiveAiFailures: 1,
      lastAiAttemptAt: start.toISOString(),
    });

    // Inside the 1h backoff: no call, failure count unchanged.
    await run(at(10));
    await run(at(59));
    expect(aiService.generate).toHaveBeenCalledTimes(1);
    expect(repository.runState?.consecutiveAiFailures).toBe(1);

    // After 1h it tries again and fails; the next wait doubles to 2h.
    await run(at(60));
    expect(aiService.generate).toHaveBeenCalledTimes(2);
    expect(repository.runState?.consecutiveAiFailures).toBe(2);
    await run(at(60 + 119));
    expect(aiService.generate).toHaveBeenCalledTimes(2);
    await run(at(60 + 120));
    expect(aiService.generate).toHaveBeenCalledTimes(3);
  });

  it("resets the failure count after a success", async () => {
    const repository = new InMemoryInsightRepository();
    repository.runState = {
      lastRunAt: start.toISOString(),
      lastAiAttemptAt: start.toISOString(),
      lastAiOutcome: "failed",
      consecutiveAiFailures: 3,
    };
    const aiService = makeAiService([insight]);
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    // 3 failures means a 4h wait.
    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: at(239),
    });
    expect(aiService.generate).not.toHaveBeenCalled();

    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: at(240),
    });
    expect(aiService.generate).toHaveBeenCalledTimes(1);
    expect(repository.runState).toMatchObject({
      lastAiOutcome: "succeeded",
      consecutiveAiFailures: 0,
    });
  });

  it("waits out the window after a success even if every AI insight was archived", async () => {
    const repository = new InMemoryInsightRepository();
    repository.runState = {
      lastRunAt: start.toISOString(),
      lastAiAttemptAt: start.toISOString(),
      lastAiOutcome: "succeeded",
      consecutiveAiFailures: 0,
    };
    // No active AI rows: before run state existed this read as "call now".
    const aiService = makeAiService([insight]);
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: at(30),
    });
    expect(aiService.generate).not.toHaveBeenCalled();

    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: new Date(start.getTime() + AI_INSIGHT_STALENESS_MS),
    });
    expect(aiService.generate).toHaveBeenCalledTimes(1);
  });

  it("claims the run before the AI call, so a concurrent load doesn't call the AI too", async () => {
    const repository = new InMemoryInsightRepository();
    let release: () => void = () => {};
    const generate = vi.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: "ok", insights: [insight] });
        }),
    );
    const aiService = { generate } as unknown as AiInsightService;
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    const first = orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: start,
    });
    // Let the first run reach the (still pending) AI call.
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(repository.runState).toMatchObject({
      lastRunAt: start.toISOString(),
      lastAiAttemptAt: start.toISOString(),
    });
    expect(await orchestrator.isRefreshDue(userId, at(1))).toBe(false);

    // A second load while the first is still waiting on the API.
    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: at(1),
    });
    release();
    await first;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(repository.runState?.lastAiOutcome).toBe("succeeded");
  });

  it("does not record an attempt when AI insights are disabled", async () => {
    const repository = new InMemoryInsightRepository();
    const aiService = {
      generate: vi.fn().mockResolvedValue({ status: "disabled" }),
    } as unknown as AiInsightService;
    const orchestrator = new InsightOrchestrator(
      repository,
      aiService,
      noRuleInsights,
    );

    await orchestrator.generateAndPersist({
      ...baseEngineInput,
      userId,
      now: start,
    });

    expect(repository.runState).toEqual({
      lastRunAt: start.toISOString(),
      lastAiAttemptAt: null,
      lastAiOutcome: null,
      consecutiveAiFailures: 0,
    });
  });
});
