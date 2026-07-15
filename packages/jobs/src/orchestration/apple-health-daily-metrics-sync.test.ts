import { describe, expect, it, vi } from "vitest";
import type { IntegrationConnection } from "@fitness-app/domain";
import { AppleHealthDailyMetricsSyncOrchestrator } from "./apple-health-daily-metrics-sync";

function createConnection(): IntegrationConnection {
  return {
    id: "00000000-0000-0000-0000-000000000020",
    userId: "00000000-0000-0000-0000-000000000001",
    provider: "apple_health",
    status: "active",
    accountLabel: "Apple Health",
    providerUserId: null,
    scopes: [],
    capabilities: ["daily_metrics"],
    lastSyncedAt: null,
    lastCursor: null,
    lastSuccessfulBatchId: null,
    lastError: null,
    lastFailedAt: null,
    lastFailureCode: null,
    lastFailureMessage: null,
    metadata: { autoCreated: true },
    connectedAt: null,
    disconnectedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    deletedAt: null,
  };
}

function createStores(connection: IntegrationConnection) {
  const connectionStore = {
    getByUserAndProvider: vi.fn().mockResolvedValue(connection),
    saveConnection: vi.fn().mockResolvedValue(connection),
    recordSyncSuccess: vi.fn().mockResolvedValue(connection),
    recordSyncFailure: vi.fn().mockResolvedValue(connection),
    disconnect: vi.fn(),
  };
  const syncJobRunStore = {
    create: vi.fn().mockResolvedValue({ id: "run-1" }),
    markRunning: vi.fn(),
    markSucceeded: vi.fn(),
    markFailed: vi.fn(),
  };
  const importBatchStore = {
    create: vi.fn().mockResolvedValue({ id: "batch-1" }),
    markProcessing: vi.fn(),
    markProcessed: vi.fn(),
    markFailed: vi.fn(),
  };

  return { connectionStore, syncJobRunStore, importBatchStore };
}

describe("AppleHealthDailyMetricsSyncOrchestrator", () => {
  it("creates a new daily activity metric row when none exists for the date", async () => {
    const connection = createConnection();
    const { connectionStore, syncJobRunStore, importBatchStore } = createStores(connection);

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-1",
          providerExternalId: "2026-07-15",
          eventOccurredAt: "2026-07-15",
          payload: {
            date: "2026-07-15",
            steps: 8123,
            vo2_max: 42.5,
            resting_heart_rate: 54,
            exercise_minutes: 35,
            active_energy_kcal: 512.4,
          },
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const dailyActivityMetricRepository = {
      findByDate: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "metric-1" }),
      update: vi.fn(),
      archive: vi.fn(),
      findById: vi.fn(),
      listByDateRange: vi.fn(),
    };

    const orchestrator = new AppleHealthDailyMetricsSyncOrchestrator(
      dailyActivityMetricRepository,
      connectionStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
    );

    const result = await orchestrator.syncDailyMetrics({
      userId: connection.userId,
      triggerType: "webhook",
      items: [
        {
          date: "2026-07-15",
          steps: 8123,
          vo2_max: 42.5,
          resting_heart_rate: 54,
          exercise_minutes: 35,
          active_energy_kcal: 512.4,
        },
      ],
    });

    expect(dailyActivityMetricRepository.findByDate).toHaveBeenCalledWith(
      connection.userId,
      "2026-07-15",
    );
    expect(dailyActivityMetricRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: connection.userId,
        metricDate: "2026-07-15",
        steps: 8123,
        vo2Max: 42.5,
        restingHeartRate: 54,
        exerciseMinutes: 35,
        activeEnergyKcal: 512.4,
        source: expect.objectContaining({
          sourceType: "imported",
          sourceProvider: "apple_health",
          sourceExternalId: "2026-07-15",
          importBatchId: "batch-1",
          rawImportEventId: "raw-1",
        }),
      }),
    );
    expect(dailyActivityMetricRepository.update).not.toHaveBeenCalled();
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith("raw-1", {
      canonicalTargetTable: "daily_activity_metrics",
      canonicalTargetId: "metric-1",
    });
    expect(result).toMatchObject({
      importBatchId: "batch-1",
      rawItemCount: 1,
      processedItemCount: 1,
      failedItemCount: 0,
    });
  });

  it("updates the existing row and preserves fields absent from the payload", async () => {
    const connection = createConnection();
    const { connectionStore, syncJobRunStore, importBatchStore } = createStores(connection);

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-2",
          providerExternalId: "2026-07-15",
          eventOccurredAt: "2026-07-15",
          payload: {
            date: "2026-07-15",
            steps: 9000,
          },
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const existing = {
      id: "metric-existing",
      userId: connection.userId,
      metricDate: "2026-07-15",
      steps: 1000,
      vo2Max: 40,
      restingHeartRate: 55,
      exerciseMinutes: 20,
      activeEnergyKcal: 300,
      source: {
        sourceType: "imported" as const,
        sourceProvider: "apple_health",
        sourceExternalId: "2026-07-15",
        importBatchId: "batch-0",
        rawImportEventId: "raw-0",
      },
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
      deletedAt: null,
    };

    const dailyActivityMetricRepository = {
      findByDate: vi.fn().mockResolvedValue(existing),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(existing),
      archive: vi.fn(),
      findById: vi.fn(),
      listByDateRange: vi.fn(),
    };

    const orchestrator = new AppleHealthDailyMetricsSyncOrchestrator(
      dailyActivityMetricRepository,
      connectionStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
    );

    await orchestrator.syncDailyMetrics({
      userId: connection.userId,
      triggerType: "webhook",
      items: [{ date: "2026-07-15", steps: 9000 }],
    });

    expect(dailyActivityMetricRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "metric-existing",
        userId: connection.userId,
        steps: 9000,
        vo2Max: 40,
        restingHeartRate: 55,
        exerciseMinutes: 20,
        activeEnergyKcal: 300,
      }),
    );
    expect(dailyActivityMetricRepository.create).not.toHaveBeenCalled();
  });

  it("records failures per item and continues processing", async () => {
    const connection = createConnection();
    const { connectionStore, syncJobRunStore, importBatchStore } = createStores(connection);

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-3",
          providerExternalId: "2026-07-15",
          eventOccurredAt: "2026-07-15",
          payload: { date: "2026-07-15", steps: 100 },
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const dailyActivityMetricRepository = {
      findByDate: vi.fn().mockRejectedValue(new Error("db unavailable")),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findById: vi.fn(),
      listByDateRange: vi.fn(),
    };

    const orchestrator = new AppleHealthDailyMetricsSyncOrchestrator(
      dailyActivityMetricRepository,
      connectionStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
    );

    const result = await orchestrator.syncDailyMetrics({
      userId: connection.userId,
      triggerType: "webhook",
      items: [{ date: "2026-07-15", steps: 100 }],
    });

    expect(rawImportEventStore.markFailed).toHaveBeenCalledWith("raw-3", "db unavailable");
    expect(result).toMatchObject({
      processedItemCount: 0,
      failedItemCount: 1,
    });
    expect(importBatchStore.markProcessed).toHaveBeenCalled();
  });
});
