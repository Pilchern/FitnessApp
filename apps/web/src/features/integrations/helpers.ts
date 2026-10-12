import type {
  ImportBatch,
  IntegrationConnection,
  SyncJobRun,
} from "@fitness-app/domain";

/**
 * Pass the profile timezone: without it the server formats in UTC, and a
 * client component would format in the browser's zone and mismatch on
 * hydration.
 */
export function formatIntegrationDateTime(
  value: string | null,
  timeZone?: string,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export type AppleHealthStream = "daily" | "sleep" | "workouts";

/**
 * Hours without a successful run before a stream reads as stale. Metrics post
 * hourly and sleep once a day. Rides only post when there is a new ride
 * (three a week), so they get a longer window.
 */
export const APPLE_HEALTH_STALE_HOURS: Record<AppleHealthStream, number> = {
  daily: 6,
  sleep: 36,
  workouts: 96,
};

export type AppleHealthStreamStatus = {
  lastReceivedLabel: string;
  received: boolean;
  stale: boolean;
};

export function buildAppleHealthStreamStatus(
  lastReceived: Record<AppleHealthStream, string | null>,
  now: Date,
  timeZone?: string,
): Record<AppleHealthStream, AppleHealthStreamStatus> {
  const build = (key: AppleHealthStream): AppleHealthStreamStatus => {
    const value = lastReceived[key];
    const ageHours = value
      ? (now.getTime() - new Date(value).getTime()) / 3_600_000
      : null;
    return {
      lastReceivedLabel: formatIntegrationDateTime(value, timeZone),
      received: value != null,
      stale: ageHours != null && ageHours > APPLE_HEALTH_STALE_HOURS[key],
    };
  };
  return {
    daily: build("daily"),
    sleep: build("sleep"),
    workouts: build("workouts"),
  };
}

/** True when the latest failure came after the latest success. */
export function isFailureUnresolved(
  lastFailedAt: string | null | undefined,
  lastSucceededAt: string | null | undefined,
) {
  if (!lastFailedAt) {
    return false;
  }
  if (!lastSucceededAt) {
    return true;
  }
  return new Date(lastFailedAt).getTime() > new Date(lastSucceededAt).getTime();
}

export function formatIntegrationStatus(
  status: IntegrationConnection["status"],
) {
  switch (status) {
    case "active":
      return "Connected";
    case "reauth_required":
      return "Reconnect needed";
    case "paused":
      return "Paused";
    case "error":
      return "Sync error";
    case "disconnected":
      return "Not connected";
    default:
      return status;
  }
}

export function integrationStatusTone(
  status: IntegrationConnection["status"],
): "default" | "accent" | "alert" {
  if (status === "active") {
    return "accent";
  }

  if (status === "error" || status === "reauth_required") {
    return "alert";
  }

  return "default";
}

export function formatSyncRunStatus(status: SyncJobRun["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Syncing...";
    case "succeeded":
      return "Complete";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "dead_letter":
      return "Failed permanently";
    default:
      return status;
  }
}

export function formatImportBatchStatus(status: ImportBatch["status"]) {
  switch (status) {
    case "received":
      return "Queued";
    case "processing":
      return "Importing";
    case "processed":
      return "Complete";
    case "partially_processed":
      return "Partially imported";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function buildFlashMessage(
  status?: string,
  error?: string,
): { tone: "success" | "error"; text: string } | null {
  if (error) {
    return {
      tone: "error",
      text: error,
    };
  }

  switch (status) {
    case "connected":
      return {
        tone: "success",
        text: "Withings connected. Your measurements are syncing now.",
      };
    case "sync_started":
      return {
        tone: "success",
        text: "Withings synced successfully.",
      };
    case "disconnected":
      return {
        tone: "success",
        text: "Withings disconnected. Your existing measurements are unchanged.",
      };
    default:
      return null;
  }
}

export function getIntegrationStatusGuidance(
  connection: IntegrationConnection | null,
) {
  if (!connection) {
    return {
      tone: "default" as const,
      text: "Not connected. Your manually logged data is always available regardless of integrations.",
    };
  }

  if (connection.status === "reauth_required") {
    return {
      tone: "alert" as const,
      text: "Your connection needs to be refreshed. Reconnect to resume automatic syncing.",
    };
  }

  if (connection.status === "error") {
    return {
      tone: "alert" as const,
      text: "The last sync didn't complete. Try syncing again or reconnect if the problem persists.",
    };
  }

  if (connection.status === "disconnected") {
    return {
      tone: "default" as const,
      text: "Disconnected. Your existing data is unchanged — reconnect any time to resume syncing.",
    };
  }

  return {
    tone: "accent" as const,
    text: "Connected and syncing. New data will appear automatically.",
  };
}
