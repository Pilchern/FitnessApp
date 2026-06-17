import type {
  EntityId,
  ImportBatch,
  IntegrationConnection,
  IntegrationProvider,
  SyncJobRun,
  SyncJobRunTriggerType,
  UserId,
} from "@fitness-app/domain";
import type { OAuthTokenSet, StoredProviderCredential } from "@fitness-app/integrations";

export type SaveConnectionInput = {
  userId: UserId;
  provider: IntegrationProvider;
  accountLabel: string | null;
  providerUserId: string | null;
  scopes: string[];
  capabilities: string[];
  metadata: Record<string, unknown>;
};

export type FinalizeOAuthConnectionInput = SaveConnectionInput & {
  tokenSet: OAuthTokenSet;
};

export type StoredIntegrationCredential = StoredProviderCredential;

export type CreateSyncJobRunInput = {
  userId: UserId;
  integrationConnectionId: EntityId | null;
  jobType: string;
  triggerType: SyncJobRunTriggerType;
  dedupeKey: string | null;
  payload: Record<string, unknown>;
};

export type CreateImportBatchInput = {
  userId: UserId;
  integrationConnectionId: EntityId;
  provider: IntegrationProvider;
  batchType: string;
  providerCursor: string | null;
  metadata: Record<string, unknown>;
};

export type CreateRawImportEventInput = {
  userId: UserId;
  importBatchId: EntityId;
  integrationConnectionId: EntityId;
  provider: IntegrationProvider;
  providerEventType: string;
  providerExternalId: string;
  eventOccurredAt: string | null;
  payload: Record<string, unknown>;
};

export type StoredRawImportEvent = {
  id: EntityId;
  providerExternalId: string;
  eventOccurredAt: string | null;
  payload: Record<string, unknown>;
};

export interface IntegrationConnectionStore {
  getByUserAndProvider(
    userId: UserId,
    provider: IntegrationProvider,
  ): Promise<IntegrationConnection | null>;
  saveConnection(
    input: SaveConnectionInput & { status: IntegrationConnection["status"] },
  ): Promise<IntegrationConnection>;
  recordSyncSuccess(input: {
    id: EntityId;
    lastSyncedAt: string;
    lastCursor: string | null;
    lastSuccessfulBatchId: EntityId;
    accountLabel?: string | null;
  }): Promise<IntegrationConnection>;
  recordSyncFailure(input: {
    id: EntityId;
    errorCode: string;
    errorMessage: string;
  }): Promise<IntegrationConnection>;
  disconnect(userId: UserId, provider: IntegrationProvider): Promise<void>;
}

export interface IntegrationCredentialStore {
  save(
    credential: StoredIntegrationCredential,
    encryptionKey: string,
  ): Promise<void>;
  getByConnectionId(
    connectionId: EntityId,
    userId: UserId,
    encryptionKey: string,
  ): Promise<StoredIntegrationCredential | null>;
  deleteByConnectionId(connectionId: EntityId, userId: UserId): Promise<void>;
}

export interface SyncJobRunStore {
  create(input: CreateSyncJobRunInput): Promise<SyncJobRun>;
  markRunning(id: EntityId): Promise<void>;
  markSucceeded(
    id: EntityId,
    result: Record<string, unknown>,
    attemptCount?: number,
  ): Promise<void>;
  markFailed(
    id: EntityId,
    error: { code: string; message: string },
    attemptCount?: number,
  ): Promise<void>;
}

export interface ImportBatchStore {
  create(input: CreateImportBatchInput): Promise<ImportBatch>;
  markProcessing(id: EntityId): Promise<void>;
  markProcessed(
    id: EntityId,
    input: {
      nextCursor: string | null;
      rawItemCount: number;
      processedItemCount: number;
      failedItemCount: number;
      metadata: Record<string, unknown>;
    },
  ): Promise<void>;
  markFailed(
    id: EntityId,
    errorSummary: string,
    counts: {
      rawItemCount: number;
      processedItemCount: number;
      failedItemCount: number;
    },
  ): Promise<void>;
}

export interface RawImportEventStore {
  createMany(inputs: CreateRawImportEventInput[]): Promise<StoredRawImportEvent[]>;
  markMapped(
    id: EntityId,
    target: { canonicalTargetTable: string; canonicalTargetId: EntityId },
  ): Promise<void>;
  markSkipped(id: EntityId): Promise<void>;
  markFailed(id: EntityId, errorMessage: string): Promise<void>;
}
