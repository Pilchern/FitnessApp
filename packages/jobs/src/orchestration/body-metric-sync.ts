import { BodyMetricService } from "@fitness-app/application";
import type {
  EntityId,
  ImportBatch,
  IntegrationConnection,
  IntegrationProvider,
  SyncJobRunTriggerType,
  UserId,
} from "@fitness-app/domain";
import {
  decryptSecret,
  encryptSecret,
  isTokenExpired,
  type BodyMetricsProviderAdapter,
} from "@fitness-app/integrations";
import type {
  FinalizeOAuthConnectionInput,
  ImportBatchStore,
  IntegrationConnectionStore,
  IntegrationCredentialStore,
  RawImportEventStore,
  StoredIntegrationCredential,
  SyncJobRunStore,
} from "./shared-types";

export type {
  FinalizeOAuthConnectionInput,
  ImportBatchStore,
  IntegrationConnectionStore,
  IntegrationCredentialStore,
  RawImportEventStore,
  StoredIntegrationCredential,
  SyncJobRunStore,
};

export type SyncBodyMetricsInput = {
  userId: UserId;
  provider: IntegrationProvider;
  triggerType: SyncJobRunTriggerType;
  forceFullResync?: boolean;
};

export type SyncBodyMetricsResult = {
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

function dedupeKey(input: SyncBodyMetricsInput) {
  return `${input.provider}:${input.userId}:body_metrics:${input.forceFullResync ? "full" : "delta"}`;
}

export class BodyMetricSyncOrchestrator {
  constructor(
    private readonly adapter: BodyMetricsProviderAdapter,
    private readonly bodyMetricService: BodyMetricService,
    private readonly connectionStore: IntegrationConnectionStore,
    private readonly credentialStore: IntegrationCredentialStore,
    private readonly syncJobRunStore: SyncJobRunStore,
    private readonly importBatchStore: ImportBatchStore,
    private readonly rawImportEventStore: RawImportEventStore,
    private readonly encryptionKey: string,
  ) {}

  async finalizeOAuthConnection(input: FinalizeOAuthConnectionInput) {
    const connection = await this.connectionStore.saveConnection({
      ...input,
      status: "active",
    });

    await this.credentialStore.save(
      {
        ...input.tokenSet,
        connectionId: connection.id,
        userId: input.userId,
        provider: input.provider,
      },
      this.encryptionKey,
    );

    return connection;
  }

  async disconnect(userId: UserId, provider: IntegrationProvider) {
    const connection = await this.connectionStore.getByUserAndProvider(userId, provider);

    if (!connection) {
      return;
    }

    await this.credentialStore.deleteByConnectionId(connection.id, userId);
    await this.connectionStore.disconnect(userId, provider);
  }

  async syncBodyMetrics(input: SyncBodyMetricsInput): Promise<SyncBodyMetricsResult> {
    const connection = await this.connectionStore.getByUserAndProvider(
      input.userId,
      input.provider,
    );

    if (!connection) {
      throw new Error("No active integration connection was found.");
    }

    const credential = await this.credentialStore.getByConnectionId(
      connection.id,
      input.userId,
      this.encryptionKey,
    );

    if (!credential) {
      throw new Error("No stored credentials were found for this connection.");
    }

    const syncRun = await this.syncJobRunStore.create({
      userId: input.userId,
      integrationConnectionId: connection.id,
      jobType: "body_metric_sync",
      triggerType: input.triggerType,
      dedupeKey: dedupeKey(input),
      payload: {
        provider: input.provider,
        forceFullResync: Boolean(input.forceFullResync),
        lastCursor: input.forceFullResync ? null : connection.lastCursor,
      },
    });

    let importBatch: ImportBatch | null = null;
    let rawItemCount = 0;
    let processedItemCount = 0;
    let failedItemCount = 0;

    try {
      await this.syncJobRunStore.markRunning(syncRun.id);

      const activeCredential = await this.refreshCredentialIfNeeded(credential);

      importBatch = await this.importBatchStore.create({
        userId: input.userId,
        integrationConnectionId: connection.id,
        provider: input.provider,
        batchType: "body_metrics",
        providerCursor: input.forceFullResync ? null : connection.lastCursor,
        metadata: {
          mode: input.forceFullResync ? "full_resync" : "incremental",
        },
      });
      const currentImportBatch = importBatch;

      await this.importBatchStore.markProcessing(currentImportBatch.id);

      const page = await this.adapter.fetchBodyMetrics({
        accessToken: activeCredential.accessToken,
        lastCursor: input.forceFullResync ? null : connection.lastCursor,
      });

      rawItemCount = page.items.length;

      const storedRawEvents = await this.rawImportEventStore.createMany(
        page.items.map((item) => ({
          userId: input.userId,
          importBatchId: currentImportBatch.id,
          integrationConnectionId: connection.id,
          provider: input.provider,
          providerEventType: item.providerEventType,
          providerExternalId: item.providerExternalId,
          eventOccurredAt: item.occurredAt,
          payload: item.payload,
        })),
      );

      for (const event of storedRawEvents) {
        try {
          const mapped = this.adapter.mapRawBodyMetricItem(
            {
              providerEventType: "measure_group",
              providerExternalId: event.providerExternalId,
              occurredAt: event.eventOccurredAt,
              payload: event.payload,
            },
            {
              importBatchId: currentImportBatch.id,
              rawImportEventId: event.id,
            },
          );

          if (!mapped) {
            await this.rawImportEventStore.markSkipped(event.id);
            continue;
          }

          const bodyMetric = await this.bodyMetricService.upsertImported({
            userId: input.userId,
            measuredOn: mapped.measuredOn,
            weightLb: mapped.weightLb ?? null,
            weightKg: mapped.weightKg ?? null,
            waistIn: mapped.waistIn ?? null,
            waistCm: mapped.waistCm ?? null,
            bodyFatPct: mapped.bodyFatPct ?? null,
            muscleMassLb: mapped.muscleMassLb ?? null,
            muscleMassKg: mapped.muscleMassKg ?? null,
            notes: mapped.notes ?? null,
            source: {
              sourceType: "imported",
              sourceProvider: input.provider,
              sourceExternalId: mapped.providerExternalId,
              importBatchId: currentImportBatch.id,
              rawImportEventId: event.id,
            },
          });

          processedItemCount += 1;

          await this.rawImportEventStore.markMapped(event.id, {
            canonicalTargetTable: "body_metrics",
            canonicalTargetId: bodyMetric.id,
          });
        } catch (error) {
          failedItemCount += 1;
          await this.rawImportEventStore.markFailed(event.id, toError(error).message);
        }
      }

      await this.importBatchStore.markProcessed(currentImportBatch.id, {
        nextCursor: page.nextCursor,
        rawItemCount,
        processedItemCount,
        failedItemCount,
        metadata: page.metadata,
      });

      const updatedConnection = await this.connectionStore.recordSyncSuccess({
        id: connection.id,
        lastSyncedAt: new Date().toISOString(),
        lastCursor: page.nextCursor ?? connection.lastCursor,
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

  private async refreshCredentialIfNeeded(
    credential: StoredIntegrationCredential,
  ): Promise<StoredIntegrationCredential> {
    if (
      !credential.refreshToken ||
      !isTokenExpired(credential.accessTokenExpiresAt)
    ) {
      return credential;
    }

    const refreshedTokenSet = await this.adapter.refreshToken({
      refreshToken: credential.refreshToken,
    });

    const refreshedCredential = {
      ...credential,
      ...refreshedTokenSet,
    };

    await this.credentialStore.save(refreshedCredential, this.encryptionKey);

    return refreshedCredential;
  }
}

export function encryptIntegrationToken(value: string, encryptionKey: string) {
  return encryptSecret(value, encryptionKey);
}

export function decryptIntegrationToken(value: string, encryptionKey: string) {
  return decryptSecret(value, encryptionKey);
}
