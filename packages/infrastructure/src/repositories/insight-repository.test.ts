import { describe, expect, it } from "vitest";
import type {
  PersistedInsight,
  UpsertInsightInput,
} from "@fitness-app/application";
import { planInsightRefreshes } from "./insight-repository";

const userId = "11111111-1111-4111-8111-111111111111";

function stored(overrides: Partial<PersistedInsight> = {}): PersistedInsight {
  return {
    id: "row-1",
    userId,
    insightDate: "2026-10-05",
    insightType: "sleep_below_target",
    status: "active",
    title: "Sleep below target last week",
    body: "Average sleep was 6.1h.",
    evidence: {
      sleepAverageHours: 6.1,
      severity: "caution",
      weekStart: "2026-10-05",
    },
    sourceKind: "rule",
    createdAt: "2026-10-12T12:00:00.000Z",
    updatedAt: "2026-10-12T12:00:00.000Z",
    dismissedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function incoming(
  overrides: Partial<UpsertInsightInput> = {},
): UpsertInsightInput {
  return {
    userId,
    insightType: "sleep_below_target",
    insightDate: "2026-10-05",
    title: "Sleep below target last week",
    body: "Average sleep was 6.1h.",
    evidence: {
      weekStart: "2026-10-05",
      sleepAverageHours: 6.1,
      severity: "caution",
    },
    sourceKind: "rule",
    ...overrides,
  };
}

describe("planInsightRefreshes", () => {
  it("refreshes an active row whose numbers changed", () => {
    const next = incoming({
      body: "Average sleep was 6.4h.",
      evidence: {
        weekStart: "2026-10-05",
        sleepAverageHours: 6.4,
        severity: "caution",
      },
    });
    expect(planInsightRefreshes([next], [stored()])).toEqual([
      { current: stored(), next },
    ]);
  });

  it("skips an unchanged row even when jsonb reordered the evidence keys", () => {
    expect(planInsightRefreshes([incoming()], [stored()])).toEqual([]);
  });

  it("never refreshes a dismissed or archived row", () => {
    const next = incoming({ body: "Average sleep was 6.4h." });
    expect(
      planInsightRefreshes(
        [next],
        [
          stored({ status: "dismissed", dismissedAt: "2026-10-13T00:00:00Z" }),
          stored({ id: "row-2", status: "archived" }),
        ],
      ),
    ).toEqual([]);
  });

  it("matches on user, type and date", () => {
    const next = incoming({ body: "New." });
    expect(
      planInsightRefreshes([next], [stored({ insightDate: "2026-09-28" })]),
    ).toEqual([]);
  });
});
