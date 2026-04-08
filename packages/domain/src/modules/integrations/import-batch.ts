import type { EntityId, IsoDateTime, UserId } from "../../shared/ids";
import type { IntegrationProvider } from "./integration-connection";

export type ImportBatchStatus =
  | "received"
  | "processing"
  | "processed"
  | "partially_processed"
  | "failed";

export type ImportBatch = {
  id: EntityId;
  userId: UserId;
  integrationConnectionId: EntityId | null;
  provider: IntegrationProvider;
  batchType: string;
  status: ImportBatchStatus;
  providerCursor: string | null;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  rawItemCount: number;
  processedItemCount: number;
  failedItemCount: number;
  errorSummary: string | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};
