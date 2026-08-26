import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntegrationConnection } from "@fitness-app/domain";
import { AppleHealthSleepSyncOrchestrator } from "./apple-health-sleep-sync";

function createConnection(): IntegrationConnection {
  return {
    id: "00000000-0000-0000-0000-000000000030",
    userId: "00000000-0000-0000-0000-000000000001",
    provider: "apple_health",
    status: "active",
    accountLabel: "Apple Health",
    providerUserId: null,
    scopes: [],
    capabilities: ["sleep"],
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

type SleepPayload = Record<string, unknown>;

function createRawImportEventStore(
  events: Array<{ id: string; date: string; payload: SleepPayload }>,
) {
  return {
    createMany: vi.fn().mockResolvedValue(
      events.map((event) => ({
        id: event.id,
        providerExternalId: event.date,
        eventOccurredAt: event.date,
        payload: event.payload,
      })),
    ),
    markMapped: vi.fn(),
    markSkipped: vi.fn(),
    markFailed: vi.fn(),
  };
}

function createExistingCheckin(overrides: Record<string, unknown> = {}) {
  return {
    id: "checkin-existing",
    userId: "00000000-0000-0000-0000-000000000001",
    checkinDate: "2026-07-15",
    restingHeartRate: null,
    hrv: null,
    sleepDurationMinutes: null,
    bedtimeLocal: null,
    wakeTimeLocal: null,
    sleepQuality: null,
    energyLevel: null,
    readinessLevel: null,
    stressLevel: null,
    sorenessLevel: null,
    alcoholCount: 0,
    notes: null,
    timeInBedMinutes: null,
    sleepEfficiencyPct: null,
    deepSleepMinutes: null,
    remSleepMinutes: null,
    coreSleepMinutes: null,
    awakeMinutes: null,
    sleepRespiratoryRate: null,
    sleepSpo2AvgPct: null,
    sleepHrvAvg: null,
    sleepAvgHeartRate: null,
    coldPlungeCompleted: null,
    source: {
      sourceType: "manual" as const,
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    },
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function createRepository(existing: unknown) {
  return {
    findByDate: vi.fn().mockResolvedValue(existing),
    create: vi.fn().mockResolvedValue({ id: "checkin-created" }),
    update: vi.fn().mockResolvedValue({ id: "checkin-existing" }),
    archive: vi.fn(),
    findById: vi.fn(),
    listByDateRange: vi.fn(),
  };
}

function createOrchestrator(
  recoveryCheckinRepository: ReturnType<typeof createRepository>,
  rawImportEventStore: ReturnType<typeof createRawImportEventStore>,
  stores: ReturnType<typeof createStores>,
) {
  return new AppleHealthSleepSyncOrchestrator(
    recoveryCheckinRepository as never,
    stores.connectionStore,
    stores.syncJobRunStore as never,
    stores.importBatchStore as never,
    rawImportEventStore,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppleHealthSleepSyncOrchestrator toMinutes boundary", () => {
  it("keeps 1440 — the largest value the route schema accepts — as minutes", async () => {
    // apps/web/src/app/api/integrations/apple-health/sleep/route.ts uses
    // z.number().min(0).max(1440), which is INCLUSIVE: 1440 is a valid payload.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const connection = createConnection();
    const stores = createStores(connection);
    const payload = {
      date: "2026-07-15",
      time_in_bed_minutes: 1440,
      sleep_duration_minutes: 1440,
      deep_sleep_minutes: 1440,
      rem_sleep_minutes: 1440,
      core_sleep_minutes: 1440,
      awake_minutes: 1440,
    };
    const rawImportEventStore = createRawImportEventStore([
      { id: "raw-1", date: "2026-07-15", payload },
    ]);
    const repository = createRepository(null);

    await createOrchestrator(repository, rawImportEventStore, stores).syncSleep(
      {
        userId: connection.userId,
        triggerType: "webhook",
        items: [payload],
      },
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeInBedMinutes: 1440,
        sleepDurationMinutes: 1440,
        deepSleepMinutes: 1440,
        remSleepMinutes: 1440,
        coreSleepMinutes: 1440,
        awakeMinutes: 1440,
      }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("converts a value that can only be seconds and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const connection = createConnection();
    const stores = createStores(connection);
    const payload = {
      date: "2026-07-15",
      // 8h and 30m expressed in seconds — impossible as minutes.
      sleep_duration_minutes: 28800,
      time_in_bed_minutes: 1441,
    };
    const rawImportEventStore = createRawImportEventStore([
      { id: "raw-1", date: "2026-07-15", payload },
    ]);
    const repository = createRepository(null);

    await createOrchestrator(repository, rawImportEventStore, stores).syncSleep(
      {
        userId: connection.userId,
        triggerType: "webhook",
        items: [payload],
      },
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sleepDurationMinutes: 480,
        timeInBedMinutes: 24,
      }),
    );
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("keeps 0 as 0 instead of treating it as absent", async () => {
    const connection = createConnection();
    const stores = createStores(connection);
    const payload = {
      date: "2026-07-15",
      awake_minutes: 0,
      deep_sleep_minutes: 0,
      sleep_duration_minutes: 0,
    };
    const rawImportEventStore = createRawImportEventStore([
      { id: "raw-1", date: "2026-07-15", payload },
    ]);
    const repository = createRepository(null);

    await createOrchestrator(repository, rawImportEventStore, stores).syncSleep(
      {
        userId: connection.userId,
        triggerType: "webhook",
        items: [payload],
      },
    );

    const [createArg] = repository.create.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(createArg.awakeMinutes).toBe(0);
    expect(createArg.deepSleepMinutes).toBe(0);
    expect(createArg.sleepDurationMinutes).toBe(0);
  });

  it("maps absent minute fields to null", async () => {
    const connection = createConnection();
    const stores = createStores(connection);
    const payload = { date: "2026-07-15", sleep_duration_minutes: 430 };
    const rawImportEventStore = createRawImportEventStore([
      { id: "raw-1", date: "2026-07-15", payload },
    ]);
    const repository = createRepository(null);

    await createOrchestrator(repository, rawImportEventStore, stores).syncSleep(
      {
        userId: connection.userId,
        triggerType: "webhook",
        items: [payload],
      },
    );

    const [createArg] = repository.create.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(createArg.sleepDurationMinutes).toBe(430);
    expect(createArg.timeInBedMinutes).toBeNull();
    expect(createArg.deepSleepMinutes).toBeNull();
    expect(createArg.remSleepMinutes).toBeNull();
    expect(createArg.coreSleepMinutes).toBeNull();
    expect(createArg.awakeMinutes).toBeNull();
  });
});

describe("AppleHealthSleepSyncOrchestrator", () => {
  it("creates a new recovery checkin when none exists for the date", async () => {
    const connection = createConnection();
    const stores = createStores(connection);
    const payload = {
      date: "2026-07-15",
      time_in_bed_minutes: 465,
      sleep_duration_minutes: 430,
      deep_sleep_minutes: 62,
      rem_sleep_minutes: 88,
      core_sleep_minutes: 280,
      awake_minutes: 35,
      sleep_efficiency_pct: 92.5,
      resting_heart_rate: 53.6,
      hrv: 71,
      sleep_hrv_avg: 68.2,
      sleep_avg_heart_rate: 51.4,
      sleep_respiratory_rate: 14.2,
      sleep_spo2_avg_pct: 96.5,
    };
    const rawImportEventStore = createRawImportEventStore([
      { id: "raw-1", date: "2026-07-15", payload },
    ]);
    const repository = createRepository(null);

    const result = await createOrchestrator(
      repository,
      rawImportEventStore,
      stores,
    ).syncSleep({
      userId: connection.userId,
      triggerType: "webhook",
      items: [payload],
    });

    expect(repository.findByDate).toHaveBeenCalledWith(
      connection.userId,
      "2026-07-15",
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: connection.userId,
        checkinDate: "2026-07-15",
        timeInBedMinutes: 465,
        sleepDurationMinutes: 430,
        deepSleepMinutes: 62,
        remSleepMinutes: 88,
        coreSleepMinutes: 280,
        awakeMinutes: 35,
        sleepEfficiencyPct: 92.5,
        // resting heart rate is an integer column — rounded on the way in.
        restingHeartRate: 54,
        hrv: 71,
        sleepHrvAvg: 68.2,
        sleepAvgHeartRate: 51.4,
        sleepRespiratoryRate: 14.2,
        sleepSpo2AvgPct: 96.5,
        sleepQuality: null,
        energyLevel: null,
        readinessLevel: null,
        stressLevel: null,
        sorenessLevel: null,
        alcoholCount: 0,
        notes: null,
        source: expect.objectContaining({
          sourceType: "imported",
          sourceProvider: "apple_health",
          sourceExternalId: "2026-07-15",
          importBatchId: "batch-1",
          rawImportEventId: "raw-1",
        }),
      }),
    );
    expect(repository.update).not.toHaveBeenCalled();
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith("raw-1", {
      canonicalTargetTable: "recovery_checkins",
      canonicalTargetId: "checkin-created",
    });
    expect(result).toMatchObject({
      importBatchId: "batch-1",
      rawItemCount: 1,
      processedItemCount: 1,
      failedItemCount: 0,
    });
  });

  it("does not wipe manually-entered subjective fields on a webhook merge", async () => {
    // Regression guard: the update path must never emit `null` for the
    // subjective columns a user filled in by hand. A `?? null` slipping into
    // the merge would silently destroy that data on the next webhook push.
    const connection = createConnection();
    const stores = createStores(connection);
    const payload = {
      date: "2026-07-15",
      sleep_duration_minutes: 455,
      deep_sleep_minutes: 70,
    };
    const rawImportEventStore = createRawImportEventStore([
      { id: "raw-2", date: "2026-07-15", payload },
    ]);
    const existing = createExistingCheckin({
      sleepQuality: 4,
      energyLevel: 7,
      readinessLevel: 8,
      stressLevel: 3,
      sorenessLevel: 2,
      alcoholCount: 2,
      notes: "Slept badly after the late session.",
      bedtimeLocal: "22:45",
      wakeTimeLocal: "06:30",
      coldPlungeCompleted: true,
    });
    const repository = createRepository(existing);

    await createOrchestrator(repository, rawImportEventStore, stores).syncSleep(
      {
        userId: connection.userId,
        triggerType: "webhook",
        items: [payload],
      },
    );

    expect(repository.create).not.toHaveBeenCalled();
    const [updateArg] = repository.update.mock.calls[0] as [
      Record<string, unknown>,
    ];

    for (const field of [
      "sleepQuality",
      "energyLevel",
      "readinessLevel",
      "stressLevel",
      "sorenessLevel",
      "alcoholCount",
      "notes",
      "bedtimeLocal",
      "wakeTimeLocal",
      "coldPlungeCompleted",
    ]) {
      // Not present at all — compactRecord leaves the column untouched.
      expect(updateArg).not.toHaveProperty(field);
      expect(updateArg[field]).toBeUndefined();
      expect(updateArg[field]).not.toBeNull();
    }

    expect(updateArg).toMatchObject({
      id: "checkin-existing",
      userId: connection.userId,
      sleepDurationMinutes: 455,
      deepSleepMinutes: 70,
    });
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith("raw-2", {
      canonicalTargetTable: "recovery_checkins",
      canonicalTargetId: "checkin-existing",
    });
  });

  it("merges three-way: payload wins, else existing, else undefined", async () => {
    const connection = createConnection();
    const stores = createStores(connection);
    const payload = {
      date: "2026-07-15",
      // Payload speaks for these two.
      sleep_duration_minutes: 455,
      resting_heart_rate: 52.4,
      // Explicit zero from the payload must still beat the existing value.
      awake_minutes: 0,
    };
    const rawImportEventStore = createRawImportEventStore([
      { id: "raw-3", date: "2026-07-15", payload },
    ]);
    const existing = createExistingCheckin({
      sleepDurationMinutes: 400,
      restingHeartRate: 60,
      awakeMinutes: 42,
      // Payload is silent about these — existing values must survive.
      timeInBedMinutes: 480,
      deepSleepMinutes: 61,
      hrv: 66,
      sleepEfficiencyPct: 90,
      sleepHrvAvg: 64,
      sleepAvgHeartRate: 50,
      // Absent from payload AND existing → must be undefined, never null.
      sleepRespiratoryRate: null,
      sleepSpo2AvgPct: null,
      remSleepMinutes: null,
      coreSleepMinutes: null,
    });
    const repository = createRepository(existing);

    await createOrchestrator(repository, rawImportEventStore, stores).syncSleep(
      {
        userId: connection.userId,
        triggerType: "webhook",
        items: [payload],
      },
    );

    const [updateArg] = repository.update.mock.calls[0] as [
      Record<string, unknown>,
    ];

    // payload wins
    expect(updateArg.sleepDurationMinutes).toBe(455);
    expect(updateArg.restingHeartRate).toBe(52);
    expect(updateArg.awakeMinutes).toBe(0);
    // existing preserved
    expect(updateArg.timeInBedMinutes).toBe(480);
    expect(updateArg.deepSleepMinutes).toBe(61);
    expect(updateArg.hrv).toBe(66);
    expect(updateArg.sleepEfficiencyPct).toBe(90);
    expect(updateArg.sleepHrvAvg).toBe(64);
    expect(updateArg.sleepAvgHeartRate).toBe(50);
    // neither side has a value → undefined so compactRecord drops the column
    for (const field of [
      "sleepRespiratoryRate",
      "sleepSpo2AvgPct",
      "remSleepMinutes",
      "coreSleepMinutes",
    ]) {
      expect(field in updateArg).toBe(true);
      expect(updateArg[field]).toBeUndefined();
    }

    expect(updateArg.source).toMatchObject({
      sourceType: "mixed",
      sourceProvider: "apple_health",
      sourceExternalId: "2026-07-15",
      importBatchId: "batch-1",
      rawImportEventId: "raw-3",
    });
  });

  it("isolates a per-item failure and keeps processing the rest of the batch", async () => {
    const connection = createConnection();
    const stores = createStores(connection);
    const items = [
      { date: "2026-07-14", sleep_duration_minutes: 410 },
      { date: "2026-07-15", sleep_duration_minutes: 420 },
      { date: "2026-07-16", sleep_duration_minutes: 430 },
    ];
    const rawImportEventStore = createRawImportEventStore([
      { id: "raw-a", date: "2026-07-14", payload: items[0] },
      { id: "raw-b", date: "2026-07-15", payload: items[1] },
      { id: "raw-c", date: "2026-07-16", payload: items[2] },
    ]);
    const repository = createRepository(null);
    repository.findByDate.mockImplementation(
      async (_userId: string, date: string) => {
        if (date === "2026-07-15") {
          throw new Error("db unavailable");
        }
        return null;
      },
    );

    const result = await createOrchestrator(
      repository,
      rawImportEventStore,
      stores,
    ).syncSleep({
      userId: connection.userId,
      triggerType: "webhook",
      items,
    });

    expect(rawImportEventStore.markFailed).toHaveBeenCalledTimes(1);
    expect(rawImportEventStore.markFailed).toHaveBeenCalledWith(
      "raw-b",
      "db unavailable",
    );
    expect(repository.create).toHaveBeenCalledTimes(2);
    expect(rawImportEventStore.markMapped).toHaveBeenCalledTimes(2);
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith(
      "raw-a",
      expect.objectContaining({ canonicalTargetTable: "recovery_checkins" }),
    );
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith(
      "raw-c",
      expect.objectContaining({ canonicalTargetTable: "recovery_checkins" }),
    );
    expect(result).toMatchObject({
      rawItemCount: 3,
      processedItemCount: 2,
      failedItemCount: 1,
    });
    expect(stores.importBatchStore.markProcessed).toHaveBeenCalledWith(
      "batch-1",
      expect.objectContaining({
        rawItemCount: 3,
        processedItemCount: 2,
        failedItemCount: 1,
      }),
    );
    expect(stores.syncJobRunStore.markSucceeded).toHaveBeenCalled();
    expect(stores.importBatchStore.markFailed).not.toHaveBeenCalled();
  });
});
