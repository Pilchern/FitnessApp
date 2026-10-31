import { describe, expect, it, vi } from "vitest";
import type { IntegrationConnection, NutritionLog } from "@fitness-app/domain";
import {
  AppleHealthNutritionSyncOrchestrator,
  nutritionNumbersFromPayload,
  type AppleHealthNutritionPayload,
} from "./apple-health-nutrition-sync";

const USER = "00000000-0000-0000-0000-000000000001";

function createConnection(): IntegrationConnection {
  return {
    id: "00000000-0000-0000-0000-000000000020",
    userId: USER,
    provider: "apple_health",
    status: "active",
    accountLabel: "Apple Health",
    providerUserId: null,
    scopes: [],
    capabilities: ["nutrition"],
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

function manualLog(overrides: Partial<NutritionLog> = {}): NutritionLog {
  return {
    id: "log-1",
    userId: USER,
    logDate: "2026-10-30",
    proteinHit: true,
    mealsOnPlan: true,
    noPostDinnerSnacking: false,
    junkLeakage: true,
    fiberTaken: true,
    alcoholCount: 2,
    creatineTaken: true,
    protein50By9am: true,
    proteinGrams: 90,
    calories: 1100,
    netCarbsGrams: 100,
    fatGrams: 30,
    fiberGrams: 10,
    notes: "late dinner",
    createdAt: "2026-10-30T12:00:00Z",
    updatedAt: "2026-10-30T12:00:00Z",
    deletedAt: null,
    ...overrides,
  };
}

/** Orchestrator over in-memory stores; raw events echo the items. */
function setup(existing: NutritionLog | null) {
  const connection = createConnection();
  const rawImportEventStore = {
    createMany: vi.fn(async (inputs: { payload: Record<string, unknown> }[]) =>
      inputs.map((input, i) => ({
        id: `raw-${i + 1}`,
        providerExternalId: (input.payload as AppleHealthNutritionPayload).date,
        eventOccurredAt: (input.payload as AppleHealthNutritionPayload).date,
        payload: input.payload,
      })),
    ),
    markMapped: vi.fn(),
    markSkipped: vi.fn(),
    markFailed: vi.fn(),
  };
  const nutritionLogRepository = {
    listByDateRange: vi.fn().mockResolvedValue(existing ? [existing] : []),
    create: vi.fn(async (input: object) => ({ ...input, id: "log-new" })),
    update: vi.fn(async (input: { id: string }) => ({ ...input })),
    archive: vi.fn(),
    findById: vi.fn(),
  };
  const importBatchStore = {
    create: vi.fn().mockResolvedValue({ id: "batch-1" }),
    markProcessing: vi.fn(),
    markProcessed: vi.fn(),
    markFailed: vi.fn(),
  };
  const orchestrator = new AppleHealthNutritionSyncOrchestrator(
    nutritionLogRepository as never,
    {
      getByUserAndProvider: vi.fn().mockResolvedValue(connection),
      saveConnection: vi.fn().mockResolvedValue(connection),
      recordSyncSuccess: vi.fn().mockResolvedValue(connection),
      recordSyncFailure: vi.fn().mockResolvedValue(connection),
      disconnect: vi.fn(),
    } as never,
    {
      create: vi.fn().mockResolvedValue({ id: "run-1" }),
      markRunning: vi.fn(),
      markSucceeded: vi.fn(),
      markFailed: vi.fn(),
    } as never,
    importBatchStore as never,
    rawImportEventStore as never,
  );
  const sync = (items: AppleHealthNutritionPayload[]) =>
    orchestrator.syncNutrition({ userId: USER, triggerType: "webhook", items });
  return {
    sync,
    nutritionLogRepository,
    rawImportEventStore,
    importBatchStore,
  };
}

describe("nutritionNumbersFromPayload", () => {
  it("net carbs = carbs - fiber, rounded after subtracting", () => {
    expect(
      nutritionNumbersFromPayload({
        date: "2026-10-30",
        calories: 2412.6,
        protein_g: 201.4,
        carbs_g: 280.4,
        fat_g: 70.5,
        fiber_g: 38.3,
      }),
    ).toEqual({
      calories: 2413,
      proteinGrams: 201,
      fatGrams: 71,
      fiberGrams: 38,
      netCarbsGrams: 242, // 280.4 - 38.3 = 242.1
    });
  });

  it("floors net carbs at 0 when fiber exceeds carbs", () => {
    expect(
      nutritionNumbersFromPayload({
        date: "2026-10-30",
        carbs_g: 10,
        fiber_g: 14,
      })?.netCarbsGrams,
    ).toBe(0);
  });

  it("uses all carbs as net when fiber is missing; null when carbs are", () => {
    expect(
      nutritionNumbersFromPayload({ date: "2026-10-30", carbs_g: 50 })
        ?.netCarbsGrams,
    ).toBe(50);
    expect(
      nutritionNumbersFromPayload({ date: "2026-10-30", protein_g: 30 })
        ?.netCarbsGrams,
    ).toBeNull();
  });

  it("returns null for a day with every value 0 or missing", () => {
    expect(nutritionNumbersFromPayload({ date: "2026-10-30" })).toBeNull();
    expect(
      nutritionNumbersFromPayload({
        date: "2026-10-30",
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: null,
        fiber_g: 0,
      }),
    ).toBeNull();
  });
});

describe("AppleHealthNutritionSyncOrchestrator", () => {
  it("creates a row with only the numeric fields when the date is new", async () => {
    const { sync, nutritionLogRepository, rawImportEventStore } = setup(null);

    const result = await sync([
      {
        date: "2026-10-30",
        calories: 2400,
        protein_g: 200,
        carbs_g: 290,
        fat_g: 70,
        fiber_g: 38,
      },
    ]);

    expect(nutritionLogRepository.listByDateRange).toHaveBeenCalledWith({
      userId: USER,
      startDate: "2026-10-30",
      endDate: "2026-10-30",
      limit: 1,
    });
    const created = nutritionLogRepository.create.mock.calls[0]![0];
    expect(created).toEqual({
      userId: USER,
      logDate: "2026-10-30",
      alcoholCount: 0,
      calories: 2400,
      proteinGrams: 200,
      fatGrams: 70,
      fiberGrams: 38,
      netCarbsGrams: 252,
    });
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith("raw-1", {
      canonicalTargetTable: "nutrition_logs",
      canonicalTargetId: "log-new",
    });
    expect(result.processedItemCount).toBe(1);
  });

  it("overwrites a partial day's numbers and never sends manual fields", async () => {
    const { sync, nutritionLogRepository } = setup(manualLog());

    await sync([
      {
        date: "2026-10-30",
        calories: 2350,
        protein_g: 195,
        carbs_g: 260,
        fat_g: 72,
        fiber_g: 35,
      },
    ]);

    expect(nutritionLogRepository.create).not.toHaveBeenCalled();
    const update = nutritionLogRepository.update.mock.calls[0]![0];
    expect(update).toEqual({
      id: "log-1",
      userId: USER,
      calories: 2350,
      proteinGrams: 195,
      fatGrams: 72,
      fiberGrams: 35,
      netCarbsGrams: 225,
    });
    for (const manual of [
      "proteinHit",
      "mealsOnPlan",
      "noPostDinnerSnacking",
      "junkLeakage",
      "fiberTaken",
      "alcoholCount",
      "creatineTaken",
      "protein50By9am",
      "notes",
      "logDate",
    ]) {
      expect(update).not.toHaveProperty(manual);
    }
  });

  it("clears a numeric field the newer payload no longer has", async () => {
    const { sync, nutritionLogRepository } = setup(manualLog());

    await sync([{ date: "2026-10-30", calories: 600, protein_g: 45 }]);

    expect(nutritionLogRepository.update.mock.calls[0]![0]).toMatchObject({
      calories: 600,
      proteinGrams: 45,
      fatGrams: null,
      fiberGrams: null,
      netCarbsGrams: null,
    });
  });

  it("skips an all-zero day without writing a row", async () => {
    const { sync, nutritionLogRepository, rawImportEventStore } = setup(null);

    const result = await sync([
      { date: "2026-10-31", calories: 0, protein_g: 0, carbs_g: 0 },
    ]);

    expect(nutritionLogRepository.listByDateRange).not.toHaveBeenCalled();
    expect(nutritionLogRepository.create).not.toHaveBeenCalled();
    expect(nutritionLogRepository.update).not.toHaveBeenCalled();
    expect(rawImportEventStore.markSkipped).toHaveBeenCalledWith("raw-1");
    expect(result).toMatchObject({
      processedItemCount: 0,
      skippedItemCount: 1,
      failedItemCount: 0,
    });
  });

  it("marks a day failed on a database error and still finishes the batch", async () => {
    const {
      sync,
      nutritionLogRepository,
      rawImportEventStore,
      importBatchStore,
    } = setup(null);
    nutritionLogRepository.create.mockRejectedValueOnce({
      message:
        'new row for relation "nutrition_logs" violates check constraint "nutrition_logs_calories_check"',
    });

    const result = await sync([
      { date: "2026-10-29", calories: 12000 },
      { date: "2026-10-30", calories: 2400 },
    ]);

    expect(rawImportEventStore.markFailed).toHaveBeenCalledWith(
      "raw-1",
      expect.stringContaining("nutrition_logs_calories_check"),
    );
    expect(rawImportEventStore.markMapped).toHaveBeenCalledWith(
      "raw-2",
      expect.objectContaining({ canonicalTargetTable: "nutrition_logs" }),
    );
    expect(importBatchStore.markProcessed).toHaveBeenCalled();
    expect(result).toMatchObject({
      processedItemCount: 1,
      failedItemCount: 1,
    });
  });
});
