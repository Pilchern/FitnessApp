import { afterEach, describe, expect, it, vi } from "vitest";
import { AiInsightService } from "../../index";
import type { InsightEngineInput } from "./insight-rules";

/**
 * `AiInsightService` had no direct tests: `insight-orchestrator.test.ts` only
 * imports its *type* and substitutes a stub, so the real class never executed
 * anywhere. Its sibling `AiWeeklyReviewService` has the same shape and seven
 * tests; this closes the gap, and these mirror those deliberately.
 *
 * Every failure path here returns `[]`, which the UI renders as "no AI
 * insights" — indistinguishable from the model legitimately having nothing to
 * say. So the value of these tests is less about the happy path than about
 * pinning which inputs silently produce nothing.
 */
const baseInput: InsightEngineInput = {
  bodyMetrics: [],
  cardioSessions: [],
  recoveryCheckins: [],
  weeklyReviews: [],
  strengthSessions: [],
  liftsCompletedByWeek: {},
};

const config = { apiKey: "test-key", model: "test-model", enabled: true };

const validPayload = [
  {
    insightType: "recovery_trend",
    title: "Sleep is trending down",
    message: "Three of the last five nights came in under seven hours.",
    severity: "warning" as const,
  },
];

function anthropicResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: "text", text }] }),
    text: async () => text,
  };
}

describe("AiInsightService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps a valid response, renaming `message` to `body`", async () => {
    // The rename is silent: if the schema or prompt ever drifts so that
    // `message` stops arriving, every card renders with an empty body rather
    // than failing loudly.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(anthropicResponse(JSON.stringify(validPayload))),
    );

    const insights = await new AiInsightService(config).generateInsights(
      baseInput,
    );

    expect(insights).toEqual([
      {
        insightType: "recovery_trend",
        title: "Sleep is trending down",
        body: "Three of the last five nights came in under seven hours.",
        severity: "warning",
      },
    ]);
  });

  it("returns nothing and makes no request when disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const insights = await new AiInsightService({
      ...config,
      enabled: false,
    }).generateInsights(baseInput);

    expect(insights).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns nothing on a non-ok API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "rate limited",
        json: async () => ({}),
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toEqual([]);
  });

  it("returns nothing when the response carries no text block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: "tool_use" }] }),
        text: async () => "",
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toEqual([]);
  });

  it("parses JSON the model wrapped in a code fence", async () => {
    // Previously JSON.parse threw into the outer catch here, so a fenced
    // response — which models produce routinely despite being asked for bare
    // JSON — silently yielded zero insights with nothing surfaced anywhere.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          anthropicResponse(
            "```json\n" + JSON.stringify(validPayload) + "\n```",
          ),
        ),
    );

    const insights = await new AiInsightService(config).generateInsights(
      baseInput,
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].body).toBe(
      "Three of the last five nights came in under seven hours.",
    );
  });

  it("parses a bare fence with no language tag, and plain JSON unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          anthropicResponse("```\n" + JSON.stringify(validPayload) + "\n```"),
        ),
    );
    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toHaveLength(1);

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(anthropicResponse(JSON.stringify(validPayload))),
    );
    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toHaveLength(1);
  });

  it("returns nothing on prose that isn't JSON at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(anthropicResponse("Here are your insights: none.")),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toEqual([]);
  });

  it("rejects a payload whose severity is outside the allowed set", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          anthropicResponse(
            JSON.stringify([{ ...validPayload[0], severity: "critical" }]),
          ),
        ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toEqual([]);
  });

  it("rejects an empty array and an over-long one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(anthropicResponse("[]")));
    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toEqual([]);

    const eleven = Array.from({ length: 11 }, () => validPayload[0]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(anthropicResponse(JSON.stringify(eleven))),
    );
    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toEqual([]);
  });

  it("returns nothing when the request itself throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new AiInsightService(config).generateInsights(baseInput),
    ).resolves.toEqual([]);
  });
});
