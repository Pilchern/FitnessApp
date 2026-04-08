import type { EntityId, IsoDateTime, UserId } from "../../shared/ids";

export type IntegrationProvider = "withings" | "peloton" | "strava" | "apple_health";

export type IntegrationConnectionStatus =
  | "active"
  | "reauth_required"
  | "paused"
  | "error"
  | "disconnected";

export type IntegrationConnection = {
  id: EntityId;
  userId: UserId;
  provider: IntegrationProvider;
  status: IntegrationConnectionStatus;
  accountLabel: string | null;
  providerUserId: string | null;
  scopes: string[];
  capabilities: string[];
  lastSyncedAt: IsoDateTime | null;
  lastCursor: string | null;
  lastSuccessfulBatchId: EntityId | null;
  lastError: string | null;
  lastFailedAt: IsoDateTime | null;
  lastFailureCode: string | null;
  lastFailureMessage: string | null;
  metadata: Record<string, unknown>;
  connectedAt: IsoDateTime | null;
  disconnectedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
