import { beforeEach, describe, expect, it, vi } from "vitest";

// apps/web has no vitest alias config, so the "@/..." modules are replaced
// by specifier with factories; nothing behind them is loaded.
const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  refreshInsightsIfDue: vi.fn(),
  getActiveInsights: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock(
  "@fitness-app/application",
  () => import("../../../../../packages/application/src/index"),
);
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/training-plan", () => import("../../lib/training-plan"));
vi.mock("@/lib/server/auth", () => ({
  requireCurrentUser: async () => ({ id: "user-1" }),
}));
vi.mock("@/lib/server/services", () => {
  const empty = { listByDateRange: async () => [] };
  return {
    getCachedUserProfile: async () => null,
    createCoreServices: async () => ({
      bodyMetricService: empty,
      cardioService: empty,
      recoveryService: empty,
      strengthService: empty,
      nutritionService: empty,
      supplementLogService: empty,
      dailyActivityService: empty,
      dexaScanService: { list: async () => [] },
      programService: { listSettings: async () => [] },
      weeklyReviewService: { listRecent: async () => [] },
      trainingTemplateService: {
        listActiveStrengthTemplates: async () => [],
        listActiveCardioTemplates: async () => [],
      },
      supplementService: { listActive: async () => [] },
    }),
  };
});
vi.mock("@/features/insights/server", () => ({
  getActiveInsights: mocks.getActiveInsights,
  refreshInsightsIfDue: mocks.refreshInsightsIfDue,
}));

import { getDashboardData } from "./server";

describe("getDashboardData insight refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveInsights.mockResolvedValue({
      insights: [],
      topInsights: [],
    });
  });

  it("renders from stored insights and schedules the refresh for after the response", async () => {
    // A refresh that never settles: if the render awaited it, this would hang.
    mocks.refreshInsightsIfDue.mockReturnValue(new Promise(() => {}));

    const data = await getDashboardData();

    expect(data.topInsights).toEqual([]);
    expect(mocks.getActiveInsights).toHaveBeenCalledTimes(1);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    // Scheduled, not run, during the render.
    expect(mocks.refreshInsightsIfDue).not.toHaveBeenCalled();

    void mocks.after.mock.calls[0]?.[0]();
    expect(mocks.refreshInsightsIfDue).toHaveBeenCalledWith("user-1");
  });

  it("logs a failed background refresh instead of throwing", async () => {
    const error = new Error("boom");
    mocks.refreshInsightsIfDue.mockRejectedValue(error);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await getDashboardData();
    await expect(mocks.after.mock.calls[0]?.[0]()).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith("[dashboard] insight refresh", error);
    logged.mockRestore();
  });
});
