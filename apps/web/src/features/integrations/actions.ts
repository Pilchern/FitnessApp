"use server";

import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createPelotonSyncOrchestrator,
  createStravaSyncOrchestrator,
  createWithingsSyncOrchestrator,
  getWithingsIntegrationConfig,
} from "@/lib/server/integrations";

function errorRedirectUrl(message: string) {
  return `/integrations?error=${encodeURIComponent(message)}`;
}

export async function disconnectWithingsAction() {
  if (!getWithingsIntegrationConfig()) {
    redirect(errorRedirectUrl("Withings not configured"));
  }
  let url = "/integrations?status=disconnected";
  try {
    const user = await requireCurrentUser();
    const orchestrator = createWithingsSyncOrchestrator();
    await orchestrator.disconnect(user.id, "withings");
  } catch (error) {
    url = errorRedirectUrl(error instanceof Error ? error.message : "Disconnect failed.");
  }
  redirect(url);
}

export async function syncWithingsAction(formData: FormData) {
  let url = "/integrations?status=sync_started";
  try {
    const user = await requireCurrentUser();
    const orchestrator = createWithingsSyncOrchestrator();
    await orchestrator.syncBodyMetrics({
      userId: user.id,
      provider: "withings",
      triggerType: formData.get("mode") === "full" ? "retry" : "manual",
      forceFullResync: formData.get("mode") === "full",
    });
  } catch (error) {
    url = errorRedirectUrl(error instanceof Error ? error.message : "Sync failed.");
  }
  redirect(url);
}

export async function syncPelotonAction(formData: FormData) {
  let url = "/integrations?status=peloton_sync_complete";
  try {
    const user = await requireCurrentUser();
    const orchestrator = createPelotonSyncOrchestrator();
    await orchestrator.syncRides({
      userId: user.id,
      provider: "peloton",
      triggerType: formData.get("mode") === "full" ? "retry" : "manual",
      forceFullResync: formData.get("mode") === "full",
    });
  } catch (error) {
    url = errorRedirectUrl(error instanceof Error ? error.message : "Peloton sync failed.");
  }
  redirect(url);
}

export async function disconnectPelotonAction() {
  let url = "/integrations?status=peloton_disconnected";
  try {
    const user = await requireCurrentUser();
    const orchestrator = createPelotonSyncOrchestrator();
    await orchestrator.disconnect(user.id, "peloton");
  } catch (error) {
    url = errorRedirectUrl(error instanceof Error ? error.message : "Disconnect failed.");
  }
  redirect(url);
}

export async function syncStravaAction(formData: FormData) {
  let url = "/integrations?status=strava_sync_complete";
  try {
    const user = await requireCurrentUser();
    const orchestrator = createStravaSyncOrchestrator();
    await orchestrator.syncRides({
      userId: user.id,
      provider: "strava",
      triggerType: formData.get("mode") === "full" ? "retry" : "manual",
      forceFullResync: formData.get("mode") === "full",
    });
  } catch (error) {
    url = errorRedirectUrl(error instanceof Error ? error.message : "Strava sync failed.");
  }
  redirect(url);
}

export async function disconnectStravaAction() {
  let url = "/integrations?status=strava_disconnected";
  try {
    const user = await requireCurrentUser();
    const orchestrator = createStravaSyncOrchestrator();
    await orchestrator.disconnect(user.id, "strava");
  } catch (error) {
    url = errorRedirectUrl(error instanceof Error ? error.message : "Disconnect failed.");
  }
  redirect(url);
}
