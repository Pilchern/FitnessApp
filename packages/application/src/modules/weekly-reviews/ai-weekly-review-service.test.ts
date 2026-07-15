import { afterEach, describe, expect, it, vi } from "vitest";
import { AiWeeklyReviewService } from "../../index";

const baseInput = {
  weekStart: "2026-03-16",
  weekEnd: "2026-03-22",
  summary: {
    averageWeightLb: 189.4,
    waistIn: 34.3,
    liftsCompleted: 3,
    ridesCompleted: 2,
    zone2Minutes: 57,
    vo2Completed: true,
    sleepAverageHours: 7.3,
    alcoholTotal: 1,
  },
};

const validResponseBody = {
  score: 78,
  scoreRationale: "Solid consistency with slightly under target Zone 2 minutes.",
  whatWorked: "Three lifts completed, sleep held above 7 hours all week.",
  whatNeedsAttention: "Zone 2 minutes came in below the weekly target.",
  strategicDecision: "Hold the plan and add one more Zone 2 session next week.",
  riskForecast: "Low risk over the next 2-3 weeks if cardio volume is restored.",
  nextBestAction: "Schedule the missed Zone 2 ride for early next week.",
};

function anthropicResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: "text", text }] }),
    text: async () => text,
  };
}

describe("AiWeeklyReviewService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null without calling fetch when disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const service = new AiWeeklyReviewService({
      apiKey: "test-key",
      model: "claude-haiku-4-5-20251001",
      enabled: false,
    });

    const result = await service.generateDraft(baseInput);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses a valid response into a WeeklyReviewAiDraft with model and generatedAt attached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(anthropicResponse(JSON.stringify(validResponseBody))),
    );

    const service = new AiWeeklyReviewService({
      apiKey: "test-key",
      model: "claude-haiku-4-5-20251001",
      enabled: true,
    });

    const result = await service.generateDraft(baseInput);

    expect(result).not.toBeNull();
    expect(result?.score).toBe(78);
    expect(result?.scoreRationale).toBe(validResponseBody.scoreRationale);
    expect(result?.whatWorked).toBe(validResponseBody.whatWorked);
    expect(result?.whatNeedsAttention).toBe(validResponseBody.whatNeedsAttention);
    expect(result?.strategicDecision).toBe(validResponseBody.strategicDecision);
    expect(result?.riskForecast).toBe(validResponseBody.riskForecast);
    expect(result?.nextBestAction).toBe(validResponseBody.nextBestAction);
    expect(result?.model).toBe("claude-haiku-4-5-20251001");
    expect(typeof result?.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(result!.generatedAt))).toBe(false);
  });

  it("fails soft (returns null, does not throw) on a non-ok API response", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "internal error",
      }),
    );

    const service = new AiWeeklyReviewService({
      apiKey: "test-key",
      model: "claude-haiku-4-5-20251001",
      enabled: true,
    });

    await expect(service.generateDraft(baseInput)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("fails soft on malformed JSON that doesn't match the response schema", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        anthropicResponse(
          JSON.stringify({ score: 200, whatWorked: "missing other required fields" }),
        ),
      ),
    );

    const service = new AiWeeklyReviewService({
      apiKey: "test-key",
      model: "claude-haiku-4-5-20251001",
      enabled: true,
    });

    await expect(service.generateDraft(baseInput)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("fails soft on non-JSON text content", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(anthropicResponse("not json at all")));

    const service = new AiWeeklyReviewService({
      apiKey: "test-key",
      model: "claude-haiku-4-5-20251001",
      enabled: true,
    });

    await expect(service.generateDraft(baseInput)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("fails soft when fetch itself throws (network error)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const service = new AiWeeklyReviewService({
      apiKey: "test-key",
      model: "claude-haiku-4-5-20251001",
      enabled: true,
    });

    await expect(service.generateDraft(baseInput)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("rejects a score outside the 1-100 range", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        anthropicResponse(JSON.stringify({ ...validResponseBody, score: 150 })),
      ),
    );

    const service = new AiWeeklyReviewService({
      apiKey: "test-key",
      model: "claude-haiku-4-5-20251001",
      enabled: true,
    });

    await expect(service.generateDraft(baseInput)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});
