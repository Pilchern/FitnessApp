import { describe, expect, it, vi } from "vitest";
import type { IntegrationConnection } from "@fitness-app/domain";
import { encryptSecret } from "@fitness-app/integrations";
import { CardioSyncOrchestrator } from "./cardio-sync";

const encryptionKey = Buffer.alloc(32).toString("base64");

function createConnection(
  overrides: Partial<IntegrationConnection> = {},
): IntegrationConnection {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    userId: "00000000-0000-0000-0000-000000000001",
    provider: "peloton",
    status: "active",
    accountLabel: "Peloton (rider)",
    providerUserId: "peloton-user",
    scopes: ["workouts"],
    capabilities: ["cardio_sessions"],
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
    ...overrides,
  };
}

function createCredentialStore(connection: IntegrationConnection) {
  return {
    save: vi.fn(),
    getByConnectionId: vi.fn().mockResolvedValue({
      connectionId: connection.id,
      userId: connection.userId,
      provider: "peloton",
      accessToken: encryptSecret("rider-username", encryptionKey),
      refreshToken: encryptSecret("rider-password", encryptionKey),
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      tokenType: "credential",
      scopes: ["workouts"],
    }),
    deleteByConnectionId: vi.fn(),
  };
}

function createConnectionStore(connection: IntegrationConnection) {
  return {
    getByUserAndProvider: vi.fn().mockResolvedValue(connection),
    saveConnection: vi.fn(),
    recordSyncSuccess: vi.fn().mockResolvedValue(connection),
    recordSyncFailure: vi.fn().mockResolvedValue(connection),
    disconnect: vi.fn(),
  };
}

function createSyncJobRunStore() {
  return {
    create: vi.fn().mockResolvedValue({ id: "run-1" }),
    markRunning: vi.fn(),
    markSucceeded: vi.fn(),
    markFailed: vi.fn(),
  };
}

function createImportBatchStore() {
  return {
    create: vi.fn().mockResolvedValue({ id: "batch-1" }),
    markProcessing: vi.fn(),
    markProcessed: vi.fn(),
    markFailed: vi.fn(),
  };
}

// Non-OAuth adapter (Peloton-shaped) — no `refreshToken` method, so
// `isOAuthAdapter` treats it as the username/password branch.
function createAdapter(overrides: Record<string, unknown> = {}) {
  return {
    provider: "peloton" as const,
    displayName: "Peloton",
    capabilities: ["cardio_sessions"],
    authenticate: vi.fn().mockResolvedValue({
      sessionToken: "session-token",
      providerUserId: "peloton-user",
    }),
    fetchCardioSessions: vi.fn(),
    mapRawCardioItem: vi.fn(),
    ...overrides,
  };
}

function baseMappedSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionDate: "2026-03-01",
    startedAt: "2026-03-01T12:00:00.000Z",
    endedAt: "2026-03-01T12:30:00.000Z",
    sessionKind: "zone2",
    plannedVsCompleted: "completed",
    durationMinutes: 30,
    zone2Minutes: 30,
    avgHeartRate: 140,
    maxHeartRate: 160,
    avgOutput: 150,
    cadenceMin: 80,
    cadenceMax: 95,
    resistanceMin: 40,
    resistanceMax: 55,
    distanceMeters: 12000,
    notes: null,
    providerExternalId: "ext-1",
    ...overrides,
  };
}

describe("CardioSyncOrchestrator.syncRides", () => {
  it("syncs a full page successfully and advances the cursor to page.nextCursor", async () => {
    const connection = createConnection({ lastCursor: "1000" });
    const connectionStore = createConnectionStore(connection);
    const credentialStore = createCredentialStore(connection);
    const syncJobRunStore = createSyncJobRunStore();
    const importBatchStore = createImportBatchStore();

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-1",
          providerExternalId: "ext-1",
          eventOccurredAt: "2026-03-01T12:00:00.000Z",
          payload: {},
        },
        {
          id: "raw-2",
          providerExternalId: "ext-2",
          eventOccurredAt: "2026-03-02T12:00:00.000Z",
          payload: {},
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const cardioService = {
      upsertImported: vi
        .fn()
        .mockResolvedValue({ created: true, session: { id: "session-1" } }),
    };

    const adapter = createAdapter({
      fetchCardioSessions: vi.fn().mockResolvedValue({
        items: [
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-1",
            occurredAt: "2026-03-01T12:00:00.000Z",
            payload: {},
          },
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-2",
            occurredAt: "2026-03-02T12:00:00.000Z",
            payload: {},
          },
        ],
        nextCursor: "1700000000",
        metadata: {},
      }),
      mapRawCardioItem: vi
        .fn()
        .mockReturnValueOnce(
          baseMappedSession({
            sessionDate: "2026-03-01",
            durationMinutes: 30,
            providerExternalId: "ext-1",
          }),
        )
        .mockReturnValueOnce(
          baseMappedSession({
            sessionDate: "2026-03-02",
            durationMinutes: 45,
            providerExternalId: "ext-2",
          }),
        ),
    });

    const orchestrator = new CardioSyncOrchestrator(
      adapter as never,
      cardioService as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
      encryptionKey,
    );

    const result = await orchestrator.syncRides({
      userId: connection.userId,
      provider: "peloton",
      triggerType: "manual",
    });

    expect(cardioService.upsertImported).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      rawItemCount: 2,
      processedItemCount: 2,
      failedItemCount: 0,
      skippedDuplicateCount: 0,
      importBatchId: "batch-1",
    });
    expect(importBatchStore.markProcessed).toHaveBeenCalledWith(
      "batch-1",
      expect.objectContaining({ nextCursor: "1700000000" }),
    );
    expect(connectionStore.recordSyncSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ lastCursor: "1700000000" }),
    );
  });

  it("dedupes items in the same page that map to the same key, counting only one insert", async () => {
    const connection = createConnection({ lastCursor: null });
    const connectionStore = createConnectionStore(connection);
    const credentialStore = createCredentialStore(connection);
    const syncJobRunStore = createSyncJobRunStore();
    const importBatchStore = createImportBatchStore();

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-1",
          providerExternalId: "ext-1",
          eventOccurredAt: "2026-03-01T12:00:00.000Z",
          payload: {},
        },
        {
          id: "raw-2",
          providerExternalId: "ext-2",
          eventOccurredAt: "2026-03-01T13:00:00.000Z",
          payload: {},
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const cardioService = {
      upsertImported: vi
        .fn()
        .mockResolvedValue({ created: true, session: { id: "session-1" } }),
    };

    // Both items map to the SAME sessionDate + durationMinutes, so they
    // produce the same dedupeKey `${userId}|${sessionDate}|${round(durationMinutes)}`.
    const adapter = createAdapter({
      fetchCardioSessions: vi.fn().mockResolvedValue({
        items: [
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-1",
            occurredAt: "2026-03-01T12:00:00.000Z",
            payload: {},
          },
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-2",
            occurredAt: "2026-03-01T13:00:00.000Z",
            payload: {},
          },
        ],
        nextCursor: "1700000100",
        metadata: {},
      }),
      mapRawCardioItem: vi
        .fn()
        .mockReturnValueOnce(
          baseMappedSession({
            sessionDate: "2026-03-01",
            durationMinutes: 30,
            providerExternalId: "ext-1",
          }),
        )
        .mockReturnValueOnce(
          baseMappedSession({
            sessionDate: "2026-03-01",
            durationMinutes: 30,
            providerExternalId: "ext-2",
          }),
        ),
    });

    const orchestrator = new CardioSyncOrchestrator(
      adapter as never,
      cardioService as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
      encryptionKey,
    );

    const result = await orchestrator.syncRides({
      userId: connection.userId,
      provider: "peloton",
      triggerType: "manual",
    });

    expect(cardioService.upsertImported).toHaveBeenCalledTimes(1);
    expect(rawImportEventStore.markSkipped).toHaveBeenCalledWith("raw-2");
    expect(result).toMatchObject({
      processedItemCount: 1,
      skippedDuplicateCount: 1,
      failedItemCount: 0,
    });
  });

  it("keeps the cursor at MAX(occurredAt) of successful items when some items in the page fail", async () => {
    const connection = createConnection({ lastCursor: "1000" });
    const connectionStore = createConnectionStore(connection);
    const credentialStore = createCredentialStore(connection);
    const syncJobRunStore = createSyncJobRunStore();
    const importBatchStore = createImportBatchStore();

    const successOccurredAt = "2026-03-05T00:00:00.000Z";
    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-1",
          providerExternalId: "ext-1",
          eventOccurredAt: successOccurredAt,
          payload: {},
        },
        {
          id: "raw-2",
          providerExternalId: "ext-2",
          eventOccurredAt: "2026-03-06T00:00:00.000Z",
          payload: {},
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const cardioService = {
      upsertImported: vi
        .fn()
        .mockResolvedValueOnce({ created: true, session: { id: "session-1" } })
        .mockRejectedValueOnce(new Error("insert failed")),
    };

    // page.nextCursor is deliberately distinct from the expected computed
    // cursor, so the assertion below proves the orchestrator does NOT just
    // pass page.nextCursor through when there are failures.
    const adapter = createAdapter({
      fetchCardioSessions: vi.fn().mockResolvedValue({
        items: [
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-1",
            occurredAt: successOccurredAt,
            payload: {},
          },
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-2",
            occurredAt: "2026-03-06T00:00:00.000Z",
            payload: {},
          },
        ],
        nextCursor: "9999999999",
        metadata: {},
      }),
      mapRawCardioItem: vi
        .fn()
        .mockReturnValueOnce(
          baseMappedSession({
            sessionDate: "2026-03-05",
            durationMinutes: 30,
            providerExternalId: "ext-1",
          }),
        )
        .mockReturnValueOnce(
          baseMappedSession({
            sessionDate: "2026-03-06",
            durationMinutes: 45,
            providerExternalId: "ext-2",
          }),
        ),
    });

    const orchestrator = new CardioSyncOrchestrator(
      adapter as never,
      cardioService as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
      encryptionKey,
    );

    const result = await orchestrator.syncRides({
      userId: connection.userId,
      provider: "peloton",
      triggerType: "manual",
    });

    const expectedCursor = String(
      Math.floor(new Date(successOccurredAt).getTime() / 1000),
    );

    expect(result).toMatchObject({ processedItemCount: 1, failedItemCount: 1 });
    expect(rawImportEventStore.markFailed).toHaveBeenCalledWith(
      "raw-2",
      "insert failed",
    );
    expect(connectionStore.recordSyncSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ lastCursor: expectedCursor }),
    );
    // Prove it's neither the stale cursor nor the page's nextCursor.
    expect(expectedCursor).not.toBe("1000");
    expect(expectedCursor).not.toBe("9999999999");
  });

  it("retains the prior connection cursor, unchanged, when every item in the page fails", async () => {
    const connection = createConnection({ lastCursor: "1000" });
    const connectionStore = createConnectionStore(connection);
    const credentialStore = createCredentialStore(connection);
    const syncJobRunStore = createSyncJobRunStore();
    const importBatchStore = createImportBatchStore();

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-1",
          providerExternalId: "ext-1",
          eventOccurredAt: "2026-03-05T00:00:00.000Z",
          payload: {},
        },
        {
          id: "raw-2",
          providerExternalId: "ext-2",
          eventOccurredAt: "2026-03-06T00:00:00.000Z",
          payload: {},
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const cardioService = {
      upsertImported: vi.fn().mockRejectedValue(new Error("db unavailable")),
    };

    const adapter = createAdapter({
      fetchCardioSessions: vi.fn().mockResolvedValue({
        items: [
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-1",
            occurredAt: "2026-03-05T00:00:00.000Z",
            payload: {},
          },
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-2",
            occurredAt: "2026-03-06T00:00:00.000Z",
            payload: {},
          },
        ],
        nextCursor: "2000000000",
        metadata: {},
      }),
      mapRawCardioItem: vi
        .fn()
        .mockReturnValueOnce(
          baseMappedSession({
            sessionDate: "2026-03-05",
            durationMinutes: 30,
            providerExternalId: "ext-1",
          }),
        )
        .mockReturnValueOnce(
          baseMappedSession({
            sessionDate: "2026-03-06",
            durationMinutes: 45,
            providerExternalId: "ext-2",
          }),
        ),
    });

    const orchestrator = new CardioSyncOrchestrator(
      adapter as never,
      cardioService as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
      encryptionKey,
    );

    const result = await orchestrator.syncRides({
      userId: connection.userId,
      provider: "peloton",
      triggerType: "manual",
    });

    expect(result).toMatchObject({ processedItemCount: 0, failedItemCount: 2 });
    expect(connectionStore.recordSyncSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ lastCursor: "1000" }),
    );
    expect(importBatchStore.markProcessed).toHaveBeenCalledWith(
      "batch-1",
      expect.objectContaining({ nextCursor: "1000" }),
    );
  });

  it("skips items whose mapper returns null without counting them as processed, failed, or duplicate", async () => {
    const connection = createConnection({ lastCursor: null });
    const connectionStore = createConnectionStore(connection);
    const credentialStore = createCredentialStore(connection);
    const syncJobRunStore = createSyncJobRunStore();
    const importBatchStore = createImportBatchStore();

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-1",
          providerExternalId: "ext-1",
          eventOccurredAt: "2026-03-05T00:00:00.000Z",
          payload: {},
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const cardioService = { upsertImported: vi.fn() };

    const adapter = createAdapter({
      fetchCardioSessions: vi.fn().mockResolvedValue({
        items: [
          {
            providerEventType: "peloton_workout",
            providerExternalId: "ext-1",
            occurredAt: "2026-03-05T00:00:00.000Z",
            payload: {},
          },
        ],
        nextCursor: "1700000200",
        metadata: {},
      }),
      mapRawCardioItem: vi.fn().mockReturnValueOnce(null),
    });

    const orchestrator = new CardioSyncOrchestrator(
      adapter as never,
      cardioService as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
      encryptionKey,
    );

    const result = await orchestrator.syncRides({
      userId: connection.userId,
      provider: "peloton",
      triggerType: "manual",
    });

    expect(cardioService.upsertImported).not.toHaveBeenCalled();
    expect(rawImportEventStore.markSkipped).toHaveBeenCalledWith("raw-1");
    expect(result).toMatchObject({
      processedItemCount: 0,
      failedItemCount: 0,
      skippedDuplicateCount: 0,
    });
  });

  it("does not create an import batch and still records sync success when the page has zero items", async () => {
    const connection = createConnection({ lastCursor: "500" });
    const connectionStore = createConnectionStore(connection);
    const credentialStore = createCredentialStore(connection);
    const syncJobRunStore = createSyncJobRunStore();
    const importBatchStore = createImportBatchStore();
    const rawImportEventStore = {
      createMany: vi.fn(),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };
    const cardioService = { upsertImported: vi.fn() };

    const adapter = createAdapter({
      fetchCardioSessions: vi.fn().mockResolvedValue({
        items: [],
        nextCursor: "1700000300",
        metadata: {},
      }),
    });

    const orchestrator = new CardioSyncOrchestrator(
      adapter as never,
      cardioService as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
      encryptionKey,
    );

    const result = await orchestrator.syncRides({
      userId: connection.userId,
      provider: "peloton",
      triggerType: "manual",
    });

    expect(importBatchStore.create).not.toHaveBeenCalled();
    expect(rawImportEventStore.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ rawItemCount: 0, importBatchId: null });
    expect(connectionStore.recordSyncSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ lastCursor: "1700000300" }),
    );
  });

  it("propagates the fetch error, records sync failure, and marks the job run failed", async () => {
    const connection = createConnection({ lastCursor: "1000" });
    const connectionStore = createConnectionStore(connection);
    const credentialStore = createCredentialStore(connection);
    const syncJobRunStore = createSyncJobRunStore();
    const importBatchStore = createImportBatchStore();
    const rawImportEventStore = {
      createMany: vi.fn(),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };
    const cardioService = { upsertImported: vi.fn() };

    const adapter = createAdapter({
      fetchCardioSessions: vi
        .fn()
        .mockRejectedValue(new Error("Peloton API error 500: boom")),
    });

    const orchestrator = new CardioSyncOrchestrator(
      adapter as never,
      cardioService as never,
      connectionStore,
      credentialStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
      encryptionKey,
    );

    await expect(
      orchestrator.syncRides({
        userId: connection.userId,
        provider: "peloton",
        triggerType: "manual",
      }),
    ).rejects.toThrow("Peloton API error 500: boom");

    expect(connectionStore.recordSyncFailure).toHaveBeenCalledWith({
      id: connection.id,
      errorCode: "sync_failed",
      errorMessage: "Peloton API error 500: boom",
    });
    expect(syncJobRunStore.markFailed).toHaveBeenCalledWith("run-1", {
      code: "sync_failed",
      message: "Peloton API error 500: boom",
    });
  });
});
