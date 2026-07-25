import { describe, expect, it, vi } from "vitest";
import type { IntegrationConnection } from "@fitness-app/domain";
import { AppleHealthWorkoutSyncOrchestrator } from "./apple-health-workout-sync";

function createConnection(): IntegrationConnection {
  return {
    id: "00000000-0000-0000-0000-000000000030",
    userId: "00000000-0000-0000-0000-000000000001",
    provider: "apple_health",
    status: "active",
    accountLabel: "Apple Health",
    providerUserId: null,
    scopes: [],
    capabilities: ["workouts"],
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
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
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

describe("AppleHealthWorkoutSyncOrchestrator", () => {
  it("maps a workout payload into a cardio session via upsertImported", async () => {
    const connection = createConnection();
    const { connectionStore, syncJobRunStore, importBatchStore } =
      createStores(connection);

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-1",
          providerExternalId: "workout-abc",
          eventOccurredAt: "2026-07-25T14:00:00Z",
          payload: {
            workout_id: "workout-abc",
            workout_type: "Cycling",
            start: "2026-07-25T14:00:00Z",
            end: "2026-07-25T14:45:00Z",
            avg_heart_rate: 142.4,
            max_heart_rate: 168,
            distance_meters: 18000,
            source_name: "Peloton",
          },
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

    const orchestrator = new AppleHealthWorkoutSyncOrchestrator(
      cardioService as never,
      connectionStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
    );

    const result = await orchestrator.syncWorkouts({
      userId: connection.userId,
      triggerType: "webhook",
      items: [
        {
          workout_id: "workout-abc",
          workout_type: "Cycling",
          start: "2026-07-25T14:00:00Z",
          end: "2026-07-25T14:45:00Z",
          avg_heart_rate: 142.4,
          max_heart_rate: 168,
          distance_meters: 18000,
          source_name: "Peloton",
        },
      ],
    });

    expect(cardioService.upsertImported).toHaveBeenCalledWith(
      connection.userId,
      expect.objectContaining({
        sessionDate: "2026-07-25",
        startedAt: "2026-07-25T14:00:00Z",
        endedAt: "2026-07-25T14:45:00Z",
        sessionKind: "zone2",
        durationMinutes: 45,
        avgHeartRate: 142,
        maxHeartRate: 168,
        distanceMeters: 18000,
        sportType: "Cycling",
        notes: "Synced via Apple Health (Peloton)",
        source: expect.objectContaining({
          sourceType: "imported",
          sourceProvider: "apple_health",
          sourceExternalId: "workout-abc",
          importBatchId: "batch-1",
          rawImportEventId: "raw-1",
        }),
      }),
    );
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith("raw-1", {
      canonicalTargetTable: "cardio_sessions",
      canonicalTargetId: "session-1",
    });
    expect(result).toMatchObject({
      importBatchId: "batch-1",
      rawItemCount: 1,
      processedItemCount: 1,
      failedItemCount: 0,
    });
  });

  it("derives durationMinutes from start/end when duration_minutes is absent", async () => {
    const connection = createConnection();
    const { connectionStore, syncJobRunStore, importBatchStore } =
      createStores(connection);

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-2",
          providerExternalId: "workout-xyz",
          eventOccurredAt: "2026-07-25T09:00:00Z",
          payload: {
            workout_id: "workout-xyz",
            workout_type: "Cycling",
            start: "2026-07-25T09:00:00Z",
            end: "2026-07-25T09:30:00Z",
          },
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const cardioService = {
      upsertImported: vi
        .fn()
        .mockResolvedValue({ created: true, session: { id: "session-2" } }),
    };

    const orchestrator = new AppleHealthWorkoutSyncOrchestrator(
      cardioService as never,
      connectionStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
    );

    await orchestrator.syncWorkouts({
      userId: connection.userId,
      triggerType: "webhook",
      items: [
        {
          workout_id: "workout-xyz",
          workout_type: "Cycling",
          start: "2026-07-25T09:00:00Z",
          end: "2026-07-25T09:30:00Z",
        },
      ],
    });

    expect(cardioService.upsertImported).toHaveBeenCalledWith(
      connection.userId,
      expect.objectContaining({ durationMinutes: 30 }),
    );
  });

  it("respects an explicit session_kind override", async () => {
    const connection = createConnection();
    const { connectionStore, syncJobRunStore, importBatchStore } =
      createStores(connection);

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-3",
          providerExternalId: "workout-hiit",
          eventOccurredAt: "2026-07-25T09:00:00Z",
          payload: {
            workout_id: "workout-hiit",
            workout_type: "HIIT",
            session_kind: "vo2",
            start: "2026-07-25T09:00:00Z",
            duration_minutes: 20,
          },
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const cardioService = {
      upsertImported: vi
        .fn()
        .mockResolvedValue({ created: true, session: { id: "session-3" } }),
    };

    const orchestrator = new AppleHealthWorkoutSyncOrchestrator(
      cardioService as never,
      connectionStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
    );

    await orchestrator.syncWorkouts({
      userId: connection.userId,
      triggerType: "webhook",
      items: [
        {
          workout_id: "workout-hiit",
          workout_type: "HIIT",
          session_kind: "vo2",
          start: "2026-07-25T09:00:00Z",
          duration_minutes: 20,
        },
      ],
    });

    expect(cardioService.upsertImported).toHaveBeenCalledWith(
      connection.userId,
      expect.objectContaining({ sessionKind: "vo2", durationMinutes: 20 }),
    );
  });

  it("records failures per item and continues processing", async () => {
    const connection = createConnection();
    const { connectionStore, syncJobRunStore, importBatchStore } =
      createStores(connection);

    const rawImportEventStore = {
      createMany: vi.fn().mockResolvedValue([
        {
          id: "raw-4",
          providerExternalId: "workout-fail",
          eventOccurredAt: "2026-07-25T09:00:00Z",
          payload: {
            workout_id: "workout-fail",
            workout_type: "Cycling",
            start: "2026-07-25T09:00:00Z",
          },
        },
      ]),
      markMapped: vi.fn(),
      markSkipped: vi.fn(),
      markFailed: vi.fn(),
    };

    const cardioService = {
      upsertImported: vi.fn().mockRejectedValue(new Error("db unavailable")),
    };

    const orchestrator = new AppleHealthWorkoutSyncOrchestrator(
      cardioService as never,
      connectionStore,
      syncJobRunStore as never,
      importBatchStore as never,
      rawImportEventStore,
    );

    const result = await orchestrator.syncWorkouts({
      userId: connection.userId,
      triggerType: "webhook",
      items: [
        {
          workout_id: "workout-fail",
          workout_type: "Cycling",
          start: "2026-07-25T09:00:00Z",
        },
      ],
    });

    expect(rawImportEventStore.markFailed).toHaveBeenCalledWith(
      "raw-4",
      "db unavailable",
    );
    expect(result).toMatchObject({
      processedItemCount: 0,
      failedItemCount: 1,
    });
    expect(importBatchStore.markProcessed).toHaveBeenCalled();
  });
});
