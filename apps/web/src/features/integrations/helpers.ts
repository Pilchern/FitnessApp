import type { ImportBatch, IntegrationConnection, SyncJobRun } from "@fitness-app/domain";

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatIntegrationDateTime(value: string | null) {
  return formatDateTime(value);
}

export function formatIntegrationStatus(status: IntegrationConnection["status"]) {
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
    case "strava_connected":
      return {
        tone: "success",
        text: "Strava connected. Your recent workouts are importing now.",
      };
    case "strava_sync_complete":
      return {
        tone: "success",
        text: "Strava synced successfully. New workouts have been added to your cardio log.",
      };
    case "strava_disconnected":
      return {
        tone: "success",
        text: "Strava disconnected. Your existing imported workouts are unchanged.",
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
