import { describe, expect, it, vi } from "vitest";
import type { IntegrationConnection } from "@fitness-app/domain";
import { BodyMetricSyncOrchestrator } from "./body-metric-sync";

function createConnection(): IntegrationConnection {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    userId: "00000000-0000-0000-0000-000000000001",
    provider: "withings",
    status: "active",
    accountLabel: "Withings body metrics",
    providerUserId: "provider-user",
    scopes: ["user.metrics"],
    capabilities: ["body_metrics"],
    lastSyncedAt: null,
    lastCursor: null,
    lastSuccessfulBatchId: null,
    lastError: null,
    lastFailedAt: null,
    lastFailureCode: null,
    lastFailureMessage: null,
    metadata: {},
    connectedAt: null,
    disconnectedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    deletedAt: null,
  };
}

describe("BodyMetricSyncOrchestrator", () => {
  it("stores raw imports before mapping them into canonical body metrics", async () => {
    const connection = createConnection();
    const bodyMetricService = {
      upsertImported: vi.fn().mockResolvedValue({ id: "metric-1" }),
    };
    const connectionStore = {
      getByUserAndProvider: vi.fn().mockResolvedValue(connection),
      saveConnection: vi.fn(),
      recordSyncSuccess: vi.fn().mockResolvedValue(connection),
      recordSyncFailure: vi.fn(),
      disconnect: vi.fn(),
    };
    const credentialStore = {
      save: vi.fn(),
      getByConnectionId: vi.fn().mockResolvedValue({
        connectionId: connection.id,
        userId: connection.userId,
        provider: "withings",
        accessToken: "token",
        refreshToken: "refresh-token",
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        tokenType: "Bearer",
        scopes: ["user.metrics"],
      }),
      deleteByConnectionId: vi.fn(),
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
    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-1",
          providerExternalId: "withings-1",
          eventOccurredAt: "2026-04-01T12:00:00.000Z",
          payload: {
            grpid: 1,
            date: 1711972800,
            measures: [{ type: 1, value: 85000, unit: -3 }],
          },
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };
    const adapter = {
      provider: "withings" as const,
      displayName: "Withings",
      capabilities: ["body_metrics"],
      buildAuthorizationUrl: vi.fn(),
      exchangeCode: vi.fn(),
      refreshToken: vi.fn(),
      fetchBodyMetrics: vi.fn().mockResolvedValue({
        items: [
          {
            providerEventType: "measure_group",
            providerExternalId: "withings-1",
            occurredAt: "2026-04-01T12:00:00.000Z",
            payload: {
              grpid: 1,
              date: 1711972800,
              measures: [{ type: 1, value: 85000, unit: -3 }],
            },
          },
        ],
        nextCursor: "1711972800",
        metadata: {},
      }),
      mapRawBodyMetricItem: vi.fn().mockReturnValue({
        measuredOn: "2024-04-01",
        weightKg: 85,
        weightLb: 187.39,
        waistIn: null,
        waistCm: null,
        bodyFatPct: null,
        muscleMassKg: null,
        muscleMassLb: null,
        notes: null,
        providerExternalId: "withings-1",
      }),
    };

    const orchestrator = new BodyMetricSyncOrchestrator(
      adapter,
      bodyMetricService as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
      Buffer.alloc(32).toString("base64"),
    );

    const result = await orchestrator.syncBodyMetrics({
      userId: connection.userId,
      provider: "withings",
      triggerType: "manual",
    });

    expect(rawImportEventStore.createMany).toHaveBeenCalledTimes(1);
    expect(bodyMetricService.upsertImported).toHaveBeenCalledTimes(1);
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith("raw-1", {
      canonicalTargetTable: "body_metrics",
      canonicalTargetId: "metric-1",
    });
    expect(result).toMatchObject({
      importBatchId: "batch-1",
      rawItemCount: 1,
      processedItemCount: 1,
      failedItemCount: 0,
    });
  });

  it("records failures when the provider fetch fails", async () => {
    const connection = createConnection();
    const connectionStore = {
      getByUserAndProvider: vi.fn().mockResolvedValue(connection),
      saveConnection: vi.fn(),
      recordSyncSuccess: vi.fn(),
      recordSyncFailure: vi.fn().mockResolvedValue(connection),
      disconnect: vi.fn(),
    };
    const credentialStore = {
      save: vi.fn(),
      getByConnectionId: vi.fn().mockResolvedValue({
        connectionId: connection.id,
        userId: connection.userId,
        provider: "withings",
        accessToken: "token",
        refreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        tokenType: "Bearer",
        scopes: ["user.metrics"],
      }),
      deleteByConnectionId: vi.fn(),
    };
    const syncJobRunStore = {
      create: vi.fn().mockResolvedValue({ id: "run-2" }),
      markRunning: vi.fn(),
      markSucceeded: vi.fn(),
      markFailed: vi.fn(),
    };
    const importBatchStore = {
      create: vi.fn().mockResolvedValue({ id: "batch-2" }),
      markProcessing: vi.fn(),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    };
    const adapter = {
      provider: "withings" as const,
      displayName: "Withings",
      capabilities: ["body_metrics"],
      buildAuthorizationUrl: vi.fn(),
      exchangeCode: vi.fn(),
      refreshToken: vi.fn(),
      fetchBodyMetrics: vi.fn().mockRejectedValue(new Error("Provider unavailable")),
      mapRawBodyMetricItem: vi.fn(),
    };

    const orchestrator = new BodyMetricSyncOrchestrator(
      adapter,
      { upsertImported: vi.fn() } as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      {
        createMany: vi.fn(),
        markMapped: vi.fn(),
        markSkipped: vi.fn(),
        markFailed: vi.fn(),
      },
      Buffer.alloc(32).toString("base64"),
    );

    await expect(
      orchestrator.syncBodyMetrics({
        userId: connection.userId,
        provider: "withings",
        triggerType: "manual",
      }),
    ).rejects.toThrow("Provider unavailable");

    expect(connectionStore.recordSyncFailure).toHaveBeenCalledWith({
      id: connection.id,
      errorCode: "sync_failed",
      errorMessage: "Provider unavailable",
    });
    expect(syncJobRunStore.markFailed).toHaveBeenCalled();
    expect(importBatchStore.markFailed).toHaveBeenCalled();
  });
});
