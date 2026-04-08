import { CardioSessionService } from "@fitness-app/application";
import type {
  EntityId,
  IntegrationConnection,
  IntegrationProvider,
  SyncJobRunTriggerType,
  UserId,
} from "@fitness-app/domain";
import {
  decryptSecret,
  isTokenExpired,
  type CardioProviderAdapter,
  type OAuthCardioProviderAdapter,
  type StoredProviderCredential,
} from "@fitness-app/integrations";
import type { FinalizeOAuthConnectionInput } from "./body-metric-sync";
import type {
  IntegrationConnectionStore,
  IntegrationCredentialStore,
  ImportBatchStore,
  RawImportEventStore,
  SyncJobRunStore,
} from "./body-metric-sync";

export type ConnectCardioProviderInput = {
  userId: UserId;
  provider: IntegrationProvider;
  username: string;
  password: string;
};

export type SyncCardioSessionsInput = {
  userId: UserId;
  provider: IntegrationProvider;
  triggerType: SyncJobRunTriggerType;
  forceFullResync?: boolean;
};

export type SyncCardioSessionsResult = {
  connection: IntegrationConnection;
  syncJobRunId: EntityId;
  importBatchId: EntityId | null;
  rawItemCount: number;
  processedItemCount: number;
  failedItemCount: number;
};

function dedupeKey(input: SyncCardioSessionsInput): string {
  return `cardio_sync:${input.userId}:${input.provider}:${input.triggerType}`;
}

function isOAuthAdapter(
  adapter: CardioProviderAdapter | OAuthCardioProviderAdapter,
): adapter is OAuthCardioProviderAdapter {
  return (
    "refreshToken" in adapter &&
    typeof (adapter as OAuthCardioProviderAdapter).refreshToken === "function"
  );
}

export class CardioSyncOrchestrator {
  constructor(
    private readonly adapter: CardioProviderAdapter | OAuthCardioProviderAdapter,
    private readonly cardioService: CardioSessionService,
    private readonly connectionStore: IntegrationConnectionStore,
    private readonly credentialStore: IntegrationCredentialStore,
    private readonly syncJobRunStore: SyncJobRunStore,
    private readonly importBatchStore: ImportBatchStore,
    private readonly rawImportEventStore: RawImportEventStore,
    private readonly encryptionKey: string,
  ) {}

  /**
   * Finalize an OAuth connection (Strava). Saves connection + encrypted tokens.
   */
  async finalizeOAuthConnection(
    input: FinalizeOAuthConnectionInput,
  ): Promise<IntegrationConnection> {
    const { tokenSet, ...connectionFields } = input;
    const connection = await this.connectionStore.saveConnection({
      ...connectionFields,
      status: "active",
    });

    await this.credentialStore.save(
      {
        ...tokenSet,
        connectionId: connection.id,
        userId: input.userId,
        provider: input.provider,
      },
      this.encryptionKey,
    );

    return connection;
  }

  /**
   * Validate Peloton credentials and save the connection.
   * Stores username encrypted as accessToken, password encrypted as refreshToken.
   */
  async connect(input: ConnectCardioProviderInput): Promise<IntegrationConnection> {
    if (isOAuthAdapter(this.adapter)) {
      throw new Error("Use finalizeOAuthConnection for OAuth providers.");
    }

    const { providerUserId } = await this.adapter.authenticate({
      username: input.username,
      password: input.password,
    });

    const connection = await this.connectionStore.saveConnection({
      userId: input.userId,
      provider: input.provider,
      accountLabel: `Peloton (${input.username})`,
      providerUserId,
      scopes: ["workouts"],
      capabilities: this.adapter.capabilities,
      metadata: { username: input.username },
      status: "active",
    });

    await this.credentialStore.save(
      {
        connectionId: connection.id,
        userId: input.userId,
        provider: input.provider,
        accessToken: input.username,
        refreshToken: input.password,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        tokenType: "credential",
        scopes: ["workouts"],
      },
      this.encryptionKey,
    );

    return connection;
  }

  async disconnect(userId: UserId, provider: IntegrationProvider): Promise<void> {
    const connection = await this.connectionStore.getByUserAndProvider(userId, provider);
    if (!connection) return;

    await this.credentialStore.deleteByConnectionId(connection.id, userId);
    await this.connectionStore.disconnect(userId, provider);
  }

  private async refreshCredentialIfNeeded(
    credential: StoredProviderCredential,
  ): Promise<StoredProviderCredential> {
    if (
      !credential.refreshToken ||
      !isTokenExpired(credential.accessTokenExpiresAt)
    ) {
      return credential;
    }

    const adapter = this.adapter as OAuthCardioProviderAdapter;
    const refreshed = await adapter.refreshToken({
      refreshToken: credential.refreshToken,
    });

    const updated = { ...credential, ...refreshed };
    await this.credentialStore.save(updated, this.encryptionKey);
    return updated;
  }

  async syncRides(input: SyncCardioSessionsInput): Promise<SyncCardioSessionsResult> {
    const connection = await this.connectionStore.getByUserAndProvider(
      input.userId,
      input.provider,
    );

    if (!connection) {
      throw new Error("No active connection was found.");
    }

    const credential = await this.credentialStore.getByConnectionId(
      connection.id,
      input.userId,
      this.encryptionKey,
    );

    if (!credential) {
      throw new Error("No stored credentials were found for this connection.");
    }

    let sessionToken: string | null = null;
    let accessToken: string | null = null;
    let providerUserId: string;

    if (isOAuthAdapter(this.adapter)) {
      const refreshed = await this.refreshCredentialIfNeeded(credential);
      accessToken = refreshed.accessToken;
      providerUserId = connection.providerUserId ?? "";
    } else {
      const username = decryptSecret(credential.accessToken, this.encryptionKey);
      const password = credential.refreshToken
        ? decryptSecret(credential.refreshToken, this.encryptionKey)
        : null;

      if (!password) {
        throw new Error("Stored password is missing — reconnect to fix this.");
      }

      const authResult = await this.adapter.authenticate({ username, password });
      sessionToken = authResult.sessionToken;
      providerUserId = authResult.providerUserId;
    }

    const syncRun = await this.syncJobRunStore.create({
      userId: input.userId,
      integrationConnectionId: connection.id,
      jobType: "cardio_session_sync",
      triggerType: input.triggerType,
      dedupeKey: dedupeKey(input),
      payload: {
        provider: input.provider,
        forceFullResync: Boolean(input.forceFullResync),
        lastCursor: input.forceFullResync ? null : connection.lastCursor,
      },
    });

    await this.syncJobRunStore.markRunning(syncRun.id);

    let importBatchId: EntityId | null = null;
    let rawItemCount = 0;
    let processedItemCount = 0;
    let failedItemCount = 0;

    try {
      const lastCursor = input.forceFullResync ? null : connection.lastCursor;

      const page = isOAuthAdapter(this.adapter)
        ? await this.adapter.fetchCardioSessions({
            accessToken: accessToken!,
            providerUserId,
            lastCursor,
          })
        : await this.adapter.fetchCardioSessions({
            sessionToken: sessionToken!,
            providerUserId,
            lastCursor,
          });

      rawItemCount = page.items.length;

      if (rawItemCount > 0) {
        const importBatch = await this.importBatchStore.create({
          userId: input.userId,
          integrationConnectionId: connection.id,
          provider: input.provider,
          batchType: "cardio_session_sync",
          providerCursor: page.nextCursor,
          metadata: page.metadata,
        });

        importBatchId = importBatch.id;
        await this.importBatchStore.markProcessing(importBatch.id);

        const rawEvents = await this.rawImportEventStore.createMany(
          page.items.map((item) => ({
            userId: input.userId,
            importBatchId: importBatch.id,
            integrationConnectionId: connection.id,
            provider: input.provider,
            providerEventType: item.providerEventType,
            providerExternalId: item.providerExternalId,
            eventOccurredAt: item.occurredAt,
            payload: item.payload,
          })),
        );

        for (let i = 0; i < page.items.length; i++) {
          const item = page.items[i];
          const rawEvent = rawEvents[i];

          try {
            const mapped = this.adapter.mapRawCardioItem(item, {
              importBatchId: importBatch.id,
              rawImportEventId: rawEvent.id,
            });

            if (!mapped) {
              await this.rawImportEventStore.markSkipped(rawEvent.id);
              continue;
            }

            const { providerExternalId, ...sessionFields } = mapped;

            await this.cardioService.upsertImported(input.userId, {
              ...sessionFields,
              source: {
                sourceType: "imported",
                sourceProvider: input.provider,
                sourceExternalId: providerExternalId,
                importBatchId: importBatch.id,
                rawImportEventId: rawEvent.id,
              },
            });

            await this.rawImportEventStore.markMapped(rawEvent.id, {
              canonicalTargetTable: "cardio_sessions",
              canonicalTargetId: rawEvent.id,
            });

            processedItemCount += 1;
          } catch (itemError) {
            const msg =
              itemError instanceof Error ? itemError.message : "Mapping failed";
            await this.rawImportEventStore.markFailed(rawEvent.id, msg);
            failedItemCount += 1;
          }
        }

        await this.importBatchStore.markProcessed(importBatch.id, {
          nextCursor: page.nextCursor,
          rawItemCount,
          processedItemCount,
          failedItemCount,
          metadata: page.metadata,
        });
      }

      await this.connectionStore.recordSyncSuccess({
        id: connection.id,
        lastSyncedAt: new Date().toISOString(),
        lastCursor: page?.nextCursor ?? null,
        lastSuccessfulBatchId:
          importBatchId ?? (connection.lastSuccessfulBatchId as EntityId),
      });

      await this.syncJobRunStore.markSucceeded(syncRun.id, {
        rawItemCount,
        processedItemCount,
        failedItemCount,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown sync error";

      await this.connectionStore.recordSyncFailure({
        id: connection.id,
        errorCode: "sync_failed",
        errorMessage: message,
      });

      await this.syncJobRunStore.markFailed(syncRun.id, {
        code: "sync_failed",
        message,
      });

      throw error;
    }

    return {
      connection,
      syncJobRunId: syncRun.id,
      importBatchId,
      rawItemCount,
      processedItemCount,
      failedItemCount,
    };
  }
}
