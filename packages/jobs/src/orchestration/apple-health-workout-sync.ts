import { CardioSessionService } from "@fitness-app/application";
import type {
  CardioSessionKind,
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
} from "./shared-types";

export type AppleHealthWorkoutPayload = {
  workout_id: string;
  workout_type: string;
  session_kind?: CardioSessionKind;
  start: string; // ISO datetime
  end?: string; // ISO datetime
  duration_minutes?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  distance_meters?: number;
  source_name?: string;
};

export type SyncAppleHealthWorkoutsInput = {
  userId: UserId;
  triggerType: SyncJobRunTriggerType;
  items: AppleHealthWorkoutPayload[];
};

export type SyncAppleHealthWorkoutsResult = {
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
  return `apple_health:${userId}:workout_sync`;
}

function toIsoDate(value: string): string {
  return value.slice(0, 10);
}

function durationMinutesOf(payload: AppleHealthWorkoutPayload): number | null {
  if (payload.duration_minutes != null) {
    return Math.round(payload.duration_minutes);
  }

  if (payload.end) {
    const startMs = new Date(payload.start).getTime();
    const endMs = new Date(payload.end).getTime();
    if (
      Number.isFinite(startMs) &&
      Number.isFinite(endMs) &&
      endMs >= startMs
    ) {
      return Math.round((endMs - startMs) / 60000);
    }
  }

  return null;
}

export class AppleHealthWorkoutSyncOrchestrator {
  constructor(
    private readonly cardioService: CardioSessionService,
    private readonly connectionStore: IntegrationConnectionStore,
    private readonly syncJobRunStore: SyncJobRunStore,
    private readonly importBatchStore: ImportBatchStore,
    private readonly rawImportEventStore: RawImportEventStore,
  ) {}

  async syncWorkouts(
    input: SyncAppleHealthWorkoutsInput,
  ): Promise<SyncAppleHealthWorkoutsResult> {
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
        capabilities: ["workouts"],
        metadata: { autoCreated: true },
        status: "active",
      });
    }

    const syncRun = await this.syncJobRunStore.create({
      userId: input.userId,
      integrationConnectionId: connection.id,
      jobType: "apple_health_workout_sync",
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
        batchType: "workout",
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
          providerEventType: "workout",
          providerExternalId: item.workout_id,
          eventOccurredAt: item.start,
          payload: item as unknown as Record<string, unknown>,
        })),
      );

      for (const event of storedRawEvents) {
        try {
          const payload = event.payload as AppleHealthWorkoutPayload;

          const { session } = await this.cardioService.upsertImported(
            input.userId,
            {
              sessionDate: toIsoDate(payload.start),
              startedAt: payload.start,
              endedAt: payload.end ?? null,
              sessionKind: payload.session_kind ?? "zone2",
              plannedVsCompleted: "completed",
              durationMinutes: durationMinutesOf(payload),
              avgHeartRate:
                payload.avg_heart_rate != null
                  ? Math.round(payload.avg_heart_rate)
                  : null,
              maxHeartRate:
                payload.max_heart_rate != null
                  ? Math.round(payload.max_heart_rate)
                  : null,
              distanceMeters: payload.distance_meters ?? null,
              sportType: payload.workout_type,
              notes: payload.source_name
                ? `Synced via Apple Health (${payload.source_name})`
                : "Synced via Apple Health",
              source: {
                sourceType: "imported",
                sourceProvider: "apple_health",
                sourceExternalId: payload.workout_id,
                importBatchId: currentImportBatch.id,
                rawImportEventId: event.id,
              },
            },
          );

          processedItemCount += 1;

          await this.rawImportEventStore.markMapped(event.id, {
            canonicalTargetTable: "cardio_sessions",
            canonicalTargetId: session.id,
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
        await this.importBatchStore.markFailed(
          importBatch.id,
          syncError.message,
          {
            rawItemCount,
            processedItemCount,
            failedItemCount,
          },
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
