import type { EntityId, IsoDateTime, UserId } from "../../shared/ids";

export type SyncJobRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type SyncJobRunTriggerType = "scheduled" | "manual" | "retry" | "system" | "webhook";

export type SyncJobRun = {
  id: EntityId;
  userId: UserId | null;
  integrationConnectionId: EntityId | null;
  jobType: string;
  status: SyncJobRunStatus;
  triggerType: SyncJobRunTriggerType;
  dedupeKey: string | null;
  attemptCount: number;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  scheduledFor: IsoDateTime | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};
