import type {
  CreateDailyActivityMetricInput,
  DailyActivityMetricRepository,
  UpdateDailyActivityMetricInput,
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

export type AppleHealthDailyMetricsPayload = {
  date: string; // YYYY-MM-DD
  steps?: number;
  vo2_max?: number;
  resting_heart_rate?: number;
  exercise_minutes?: number;
  active_energy_kcal?: number;
};

export type SyncAppleHealthDailyMetricsInput = {
  userId: UserId;
  triggerType: SyncJobRunTriggerType;
  items: AppleHealthDailyMetricsPayload[];
};

export type SyncAppleHealthDailyMetricsResult = {
  connection: IntegrationConnection;
  syncJobRunId: EntityId;
  importBatchId: EntityId;
  rawItemCount: number;
  processedItemCount: number;
  failedItemCount: number;
};

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unexpected sync error.");
}

function dedupeKey(userId: UserId) {
  return `apple_health:${userId}:daily_metrics_sync`;
}

function toRoundedOrNull(value: number | undefined | null): number | null {
  if (value == null) return null;
  return Math.round(value);
}

export class AppleHealthDailyMetricsSyncOrchestrator {
  constructor(
    private readonly dailyActivityMetricRepository: DailyActivityMetricRepository,
    private readonly connectionStore: IntegrationConnectionStore,
    private readonly syncJobRunStore: SyncJobRunStore,
    private readonly importBatchStore: ImportBatchStore,
    private readonly rawImportEventStore: RawImportEventStore,
  ) {}

  async syncDailyMetrics(
    input: SyncAppleHealthDailyMetricsInput,
  ): Promise<SyncAppleHealthDailyMetricsResult> {
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
        capabilities: ["daily_metrics"],
        metadata: { autoCreated: true },
        status: "active",
      });
    }

    const syncRun = await this.syncJobRunStore.create({
      userId: input.userId,
      integrationConnectionId: connection.id,
      jobType: "apple_health_daily_metrics_sync",
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
    let failedItemCount = 0;

    try {
      await this.syncJobRunStore.markRunning(syncRun.id);

      importBatch = await this.importBatchStore.create({
        userId: input.userId,
        integrationConnectionId: connection.id,
        provider: "apple_health",
        batchType: "daily_metrics",
        providerCursor: null,
        metadata: {
          itemCount: input.items.length,
        },
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
          providerEventType: "daily_metrics",
          providerExternalId: item.date,
          eventOccurredAt: item.date,
          payload: item as unknown as Record<string, unknown>,
        })),
      );

      for (const event of storedRawEvents) {
        try {
          const payload = event.payload as AppleHealthDailyMetricsPayload;
          const metricDate = event.providerExternalId;

          const existing = await this.dailyActivityMetricRepository.findByDate(
            input.userId,
            metricDate,
          );

          if (existing) {
            const updateInput: UpdateDailyActivityMetricInput = {
              id: existing.id,
              userId: input.userId,
              steps: toRoundedOrNull(payload.steps) ?? existing.steps ?? undefined,
              vo2Max: payload.vo2_max ?? existing.vo2Max ?? undefined,
              restingHeartRate:
                toRoundedOrNull(payload.resting_heart_rate) ??
                existing.restingHeartRate ??
                undefined,
              exerciseMinutes:
                toRoundedOrNull(payload.exercise_minutes) ??
                existing.exerciseMinutes ??
                undefined,
              activeEnergyKcal:
                payload.active_energy_kcal ?? existing.activeEnergyKcal ?? undefined,
              source: {
                sourceType: "imported",
                sourceProvider: "apple_health",
                sourceExternalId: metricDate,
                importBatchId: currentImportBatch.id,
                rawImportEventId: event.id,
              },
            };

            await this.dailyActivityMetricRepository.update(updateInput);

            processedItemCount += 1;

            await this.rawImportEventStore.markMapped(event.id, {
              canonicalTargetTable: "daily_activity_metrics",
              canonicalTargetId: existing.id,
            });
          } else {
            const createInput: CreateDailyActivityMetricInput = {
              userId: input.userId,
              metricDate,
              steps: toRoundedOrNull(payload.steps),
              vo2Max: payload.vo2_max ?? null,
              restingHeartRate: toRoundedOrNull(payload.resting_heart_rate),
              exerciseMinutes: toRoundedOrNull(payload.exercise_minutes),
              activeEnergyKcal: payload.active_energy_kcal ?? null,
              source: {
                sourceType: "imported",
                sourceProvider: "apple_health",
                sourceExternalId: metricDate,
                importBatchId: currentImportBatch.id,
                rawImportEventId: event.id,
              },
            };

            const created = await this.dailyActivityMetricRepository.create(createInput);

            processedItemCount += 1;

            await this.rawImportEventStore.markMapped(event.id, {
              canonicalTargetTable: "daily_activity_metrics",
              canonicalTargetId: created.id,
            });
          }
        } catch (error) {
          failedItemCount += 1;
          await this.rawImportEventStore.markFailed(event.id, toError(error).message);
        }
      }

      await this.importBatchStore.markProcessed(currentImportBatch.id, {
        nextCursor: null,
        rawItemCount,
        processedItemCount,
        failedItemCount,
        metadata: { itemCount: input.items.length },
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
        failedItemCount,
      };
    } catch (error) {
      const syncError = toError(error);

      if (importBatch) {
        await this.importBatchStore.markFailed(importBatch.id, syncError.message, {
          rawItemCount,
          processedItemCount,
          failedItemCount,
        });
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
