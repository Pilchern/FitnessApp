import type {
  NutritionLogRepository,
  UpdateNutritionLogInput,
} from "@fitness-app/application";
import type {
  EntityId,
  ImportBatch,
  IntegrationConnection,
  SyncJobRunTriggerType,
  UserId,
} from "@fitness-app/domain";
import type {
  ImportBatchStore,
  IntegrationConnectionStore,
  RawImportEventStore,
  SyncJobRunStore,
} from "./body-metric-sync";

/**
 * Daily nutrition totals from Apple Health (Health Auto Export, which reads
 * what Cronometer writes to HealthKit) into nutrition_logs, one row per day.
 *
 * Only the numeric columns are written: calories, protein, fat, fiber and
 * net carbs (carbs minus fiber, floored at 0). The manual columns (the
 * habit checkboxes, alcohol, creatine, notes) are never touched; a new row
 * leaves them at their defaults. A later payload for the same date replaces
 * the numbers, since a day keeps filling in as meals are logged. A day with
 * every value 0 or missing is skipped: nothing was logged.
 */

export type AppleHealthNutritionPayload = {
  date: string; // YYYY-MM-DD
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
};

export type SyncAppleHealthNutritionInput = {
  userId: UserId;
  triggerType: SyncJobRunTriggerType;
  items: AppleHealthNutritionPayload[];
};

export type SyncAppleHealthNutritionResult = {
  connection: IntegrationConnection;
  syncJobRunId: EntityId;
  importBatchId: EntityId;
  rawItemCount: number;
  processedItemCount: number;
  skippedItemCount: number;
  failedItemCount: number;
};

/** The numeric nutrition_logs columns this sync owns. */
export type NutritionNumbers = {
  calories: number | null;
  proteinGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  netCarbsGrams: number | null;
};

function rounded(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

/**
 * The columns to write for one day, or null when every value is 0 or
 * missing. Net carbs = max(carbs - fiber, 0), from the unrounded values.
 */
export function nutritionNumbersFromPayload(
  payload: AppleHealthNutritionPayload,
): NutritionNumbers | null {
  const carbs = payload.carbs_g;
  const fiber = payload.fiber_g;
  const hasCarbs = typeof carbs === "number" && Number.isFinite(carbs);
  const numbers: NutritionNumbers = {
    calories: rounded(payload.calories),
    proteinGrams: rounded(payload.protein_g),
    fatGrams: rounded(payload.fat_g),
    fiberGrams: rounded(fiber),
    netCarbsGrams: hasCarbs
      ? Math.max(
          Math.round(
            carbs -
              (typeof fiber === "number" && Number.isFinite(fiber) ? fiber : 0),
          ),
          0,
        )
      : null,
  };
  const anyLogged = [
    payload.calories,
    payload.protein_g,
    carbs,
    payload.fat_g,
    fiber,
  ].some((v) => typeof v === "number" && Number.isFinite(v) && v !== 0);
  return anyLogged ? numbers : null;
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }
  // Supabase errors are plain objects with a message.
  if (
    error &&
    typeof error === "object" &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return new Error((error as { message: string }).message);
  }
  return new Error("Unexpected sync error.");
}

function dedupeKey(userId: UserId) {
  return `apple_health:${userId}:nutrition_sync`;
}

export class AppleHealthNutritionSyncOrchestrator {
  constructor(
    private readonly nutritionLogRepository: NutritionLogRepository,
    private readonly connectionStore: IntegrationConnectionStore,
    private readonly syncJobRunStore: SyncJobRunStore,
    private readonly importBatchStore: ImportBatchStore,
    private readonly rawImportEventStore: RawImportEventStore,
  ) {}

  async syncNutrition(
    input: SyncAppleHealthNutritionInput,
  ): Promise<SyncAppleHealthNutritionResult> {
    let connection = await this.connectionStore.getByUserAndProvider(
      input.userId,
      "apple_health",
    );

    if (!connection) {
      connection = await this.connectionStore.saveConnection({
        userId: input.userId,
        provider: "apple_health",
        accountLabel: "Apple Health",
        providerUserId: null,
        scopes: [],
        capabilities: ["nutrition"],
        metadata: { autoCreated: true },
        status: "active",
      });
    }

    const syncRun = await this.syncJobRunStore.create({
      userId: input.userId,
      integrationConnectionId: connection.id,
      jobType: "apple_health_nutrition_sync",
      triggerType: input.triggerType,
      dedupeKey: dedupeKey(input.userId),
      payload: {
        provider: "apple_health",
        itemCount: input.items.length,
      },
    });

    let importBatch: ImportBatch | null = null;
    let rawItemCount = 0;
    let processedItemCount = 0;
    let skippedItemCount = 0;
    let failedItemCount = 0;

    try {
      await this.syncJobRunStore.markRunning(syncRun.id);

      importBatch = await this.importBatchStore.create({
        userId: input.userId,
        integrationConnectionId: connection.id,
        provider: "apple_health",
        batchType: "nutrition",
        providerCursor: null,
        metadata: { itemCount: input.items.length },
      });
      const currentImportBatch = importBatch;

      await this.importBatchStore.markProcessing(currentImportBatch.id);

      rawItemCount = input.items.length;

      const storedRawEvents = await this.rawImportEventStore.createMany(
        input.items.map((item) => ({
          userId: input.userId,
          importBatchId: currentImportBatch.id,
          integrationConnectionId: connection.id,
          provider: "apple_health" as const,
          providerEventType: "nutrition_daily",
          providerExternalId: item.date,
          eventOccurredAt: item.date,
          payload: item as unknown as Record<string, unknown>,
        })),
      );

      for (const event of storedRawEvents) {
        try {
          const payload = event.payload as AppleHealthNutritionPayload;
          const logDate = event.providerExternalId;
          const numbers = nutritionNumbersFromPayload(payload);

          if (!numbers) {
            skippedItemCount += 1;
            await this.rawImportEventStore.markSkipped(event.id);
            continue;
          }

          const [existing] = await this.nutritionLogRepository.listByDateRange({
            userId: input.userId,
            startDate: logDate,
            endDate: logDate,
            limit: 1,
          });

          // Numeric columns only; manual columns are left as they are.
          const saved = existing
            ? await this.nutritionLogRepository.update({
                id: existing.id,
                userId: input.userId,
                ...numbers,
              } satisfies UpdateNutritionLogInput)
            : await this.nutritionLogRepository.create({
                userId: input.userId,
                logDate,
                alcoholCount: 0,
                ...numbers,
              });

          processedItemCount += 1;
          await this.rawImportEventStore.markMapped(event.id, {
            canonicalTargetTable: "nutrition_logs",
            canonicalTargetId: saved.id,
          });
        } catch (error) {
          failedItemCount += 1;
          await this.rawImportEventStore.markFailed(
            event.id,
            toError(error).message,
          );
        }
      }

      await this.importBatchStore.markProcessed(currentImportBatch.id, {
        nextCursor: null,
        rawItemCount,
        processedItemCount,
        failedItemCount,
        metadata: { itemCount: input.items.length, skippedItemCount },
      });

      const updatedConnection = await this.connectionStore.recordSyncSuccess({
        id: connection.id,
        lastSyncedAt: new Date().toISOString(),
        lastCursor: null,
        lastSuccessfulBatchId: currentImportBatch.id,
      });

      await this.syncJobRunStore.markSucceeded(syncRun.id, {
        importBatchId: currentImportBatch.id,
        rawItemCount,
        processedItemCount,
        failedItemCount,
      });

      return {
        connection: updatedConnection,
        syncJobRunId: syncRun.id,
        importBatchId: currentImportBatch.id,
        rawItemCount,
        processedItemCount,
        skippedItemCount,
        failedItemCount,
      };
    } catch (error) {
      const syncError = toError(error);

      if (importBatch) {
        await this.importBatchStore.markFailed(
          importBatch.id,
          syncError.message,
          { rawItemCount, processedItemCount, failedItemCount },
        );
      }

      await this.connectionStore.recordSyncFailure({
        id: connection.id,
        errorCode: "sync_failed",
        errorMessage: syncError.message,
      });

      await this.syncJobRunStore.markFailed(syncRun.id, {
        code: "sync_failed",
        message: syncError.message,
      });

      throw syncError;
    }
  }
}
