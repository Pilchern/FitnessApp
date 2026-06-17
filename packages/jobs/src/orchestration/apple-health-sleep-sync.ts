import type {
  CreateRecoveryCheckinInput,
  RecoveryCheckinRepository,
  UpdateRecoveryCheckinInput,
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

export type AppleHealthSleepPayload = {
  date: string; // YYYY-MM-DD
  time_in_bed_minutes?: number;
  sleep_duration_minutes?: number;
  deep_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  core_sleep_minutes?: number;
  awake_minutes?: number;
  sleep_efficiency_pct?: number;
  resting_heart_rate?: number;
  hrv?: number;
  sleep_hrv_avg?: number;
  sleep_avg_heart_rate?: number;
  sleep_respiratory_rate?: number;
  sleep_spo2_avg_pct?: number;
};

export type SyncAppleHealthSleepInput = {
  userId: UserId;
  triggerType: SyncJobRunTriggerType;
  items: AppleHealthSleepPayload[];
};

export type SyncAppleHealthSleepResult = {
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
  return `apple_health:${userId}:sleep_sync`;
}

function toMinutes(value: number | undefined | null): number | null {
  if (value == null) return null;
  // The route schema validates incoming sleep fields as minutes (0..1440).
  // Defensive ceiling for any caller that bypasses the edge schema: values
  // >= 1440 (24h * 60) almost certainly came in as seconds; convert and warn.
  if (value >= 1440) {
    // eslint-disable-next-line no-console
    console.warn(
      `[apple-health-sleep-sync] sleep value ${value} >= 1440 — assuming seconds and converting to minutes`,
    );
    return Math.round(value / 60);
  }
  return Math.round(value);
}

export class AppleHealthSleepSyncOrchestrator {
  constructor(
    private readonly recoveryCheckinRepository: RecoveryCheckinRepository,
    private readonly connectionStore: IntegrationConnectionStore,
    private readonly syncJobRunStore: SyncJobRunStore,
    private readonly importBatchStore: ImportBatchStore,
    private readonly rawImportEventStore: RawImportEventStore,
  ) {}

  async syncSleep(input: SyncAppleHealthSleepInput): Promise<SyncAppleHealthSleepResult> {
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
        capabilities: ["sleep"],
        metadata: { autoCreated: true },
        status: "active",
      });
    }

    const syncRun = await this.syncJobRunStore.create({
      userId: input.userId,
      integrationConnectionId: connection.id,
      jobType: "apple_health_sleep_sync",
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
        batchType: "sleep",
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
          providerEventType: "sleep_night",
          providerExternalId: item.date,
          eventOccurredAt: item.date,
          payload: item as unknown as Record<string, unknown>,
        })),
      );

      for (const event of storedRawEvents) {
        try {
          const payload = event.payload as AppleHealthSleepPayload;
          const checkinDate = event.providerExternalId;

          const existing = await this.recoveryCheckinRepository.findByDate(
            input.userId,
            checkinDate,
          );

          if (existing) {
            const updateInput: UpdateRecoveryCheckinInput = {
              id: existing.id,
              userId: input.userId,
              sleepDurationMinutes:
                toMinutes(payload.sleep_duration_minutes) ?? existing.sleepDurationMinutes ?? undefined,
              restingHeartRate:
                (payload.resting_heart_rate != null ? Math.round(payload.resting_heart_rate) : null) ?? existing.restingHeartRate ?? undefined,
              hrv: payload.hrv ?? existing.hrv ?? undefined,
              timeInBedMinutes:
                toMinutes(payload.time_in_bed_minutes) ?? existing.timeInBedMinutes ?? undefined,
              sleepEfficiencyPct:
                payload.sleep_efficiency_pct ?? existing.sleepEfficiencyPct ?? undefined,
              deepSleepMinutes:
                toMinutes(payload.deep_sleep_minutes) ?? existing.deepSleepMinutes ?? undefined,
              remSleepMinutes:
                toMinutes(payload.rem_sleep_minutes) ?? existing.remSleepMinutes ?? undefined,
              coreSleepMinutes:
                toMinutes(payload.core_sleep_minutes) ?? existing.coreSleepMinutes ?? undefined,
              awakeMinutes: toMinutes(payload.awake_minutes) ?? existing.awakeMinutes ?? undefined,
              sleepRespiratoryRate:
                payload.sleep_respiratory_rate ?? existing.sleepRespiratoryRate ?? undefined,
              sleepSpo2AvgPct:
                payload.sleep_spo2_avg_pct ?? existing.sleepSpo2AvgPct ?? undefined,
              sleepHrvAvg: payload.sleep_hrv_avg ?? existing.sleepHrvAvg ?? undefined,
              sleepAvgHeartRate:
                payload.sleep_avg_heart_rate ?? existing.sleepAvgHeartRate ?? undefined,
              source: {
                sourceType: "mixed",
                sourceProvider: "apple_health",
                sourceExternalId: checkinDate,
                importBatchId: currentImportBatch.id,
                rawImportEventId: event.id,
              },
            };

            await this.recoveryCheckinRepository.update(updateInput);

            processedItemCount += 1;

            await this.rawImportEventStore.markMapped(event.id, {
              canonicalTargetTable: "recovery_checkins",
              canonicalTargetId: existing.id,
            });
          } else {
            const createInput: CreateRecoveryCheckinInput = {
              userId: input.userId,
              checkinDate,
              sleepDurationMinutes: toMinutes(payload.sleep_duration_minutes),
              restingHeartRate: payload.resting_heart_rate != null ? Math.round(payload.resting_heart_rate) : null,
              hrv: payload.hrv ?? null,
              sleepQuality: null,
              energyLevel: null,
              readinessLevel: null,
              stressLevel: null,
              sorenessLevel: null,
              alcoholCount: 0,
              notes: null,
              timeInBedMinutes: toMinutes(payload.time_in_bed_minutes),
              sleepEfficiencyPct: payload.sleep_efficiency_pct ?? null,
              deepSleepMinutes: toMinutes(payload.deep_sleep_minutes),
              remSleepMinutes: toMinutes(payload.rem_sleep_minutes),
              coreSleepMinutes: toMinutes(payload.core_sleep_minutes),
              awakeMinutes: toMinutes(payload.awake_minutes),
              sleepRespiratoryRate: payload.sleep_respiratory_rate ?? null,
              sleepSpo2AvgPct: payload.sleep_spo2_avg_pct ?? null,
              sleepHrvAvg: payload.sleep_hrv_avg ?? null,
              sleepAvgHeartRate: payload.sleep_avg_heart_rate ?? null,
              source: {
                sourceType: "imported",
                sourceProvider: "apple_health",
                sourceExternalId: checkinDate,
                importBatchId: currentImportBatch.id,
                rawImportEventId: event.id,
              },
            };

            const created = await this.recoveryCheckinRepository.create(createInput);

            processedItemCount += 1;

            await this.rawImportEventStore.markMapped(event.id, {
              canonicalTargetTable: "recovery_checkins",
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
