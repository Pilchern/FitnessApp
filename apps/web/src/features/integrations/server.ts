import "server-only";

import { headers } from "next/headers";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createIntegrationStatusService,
  getStravaIntegrationConfig,
  getWithingsIntegrationConfig,
  hasAppleHealthWebhookToken,
} from "@/lib/server/integrations";
import { hasPelotonServerEnv, hasAppleHealthServerEnv } from "@/lib/server/env";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { buildFlashMessage } from "./helpers";
import type { IntegrationsPageData } from "./types";

async function getAppUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto =
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}`;
}

const APPLE_HEALTH_JOBS = {
  daily: "apple_health_daily_metrics_sync",
  sleep: "apple_health_sleep_sync",
  workouts: "apple_health_workout_sync",
} as const;

/** When each Apple Health stream last synced, so phone setup can be checked here. */
async function getAppleHealthLastReceived(userId: string) {
  const client = createSupabaseAdminClient();
  const entries = await Promise.all(
    Object.entries(APPLE_HEALTH_JOBS).map(async ([key, jobType]) => {
      const { data } = await client
        .from("sync_job_runs")
        .select("finished_at")
        .eq("user_id", userId)
        .eq("job_type", jobType)
        .eq("status", "succeeded")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return [key, (data?.finished_at as string | null) ?? null] as const;
    }),
  );
  return Object.fromEntries(
    entries,
  ) as IntegrationsPageData["appleHealthLastReceived"];
}

export async function getIntegrationsPageData(input?: {
  status?: string;
  error?: string;
}): Promise<IntegrationsPageData> {
  const user = await requireCurrentUser();
  const service = await createIntegrationStatusService();
  const [
    snapshot,
    appUrl,
    appleHealthHasWebhookToken,
    appleHealthLastReceived,
  ] = await Promise.all([
    service.getSnapshot({ userId: user.id, limit: 8 }),
    getAppUrl(),
    hasAppleHealthWebhookToken(user.id),
    getAppleHealthLastReceived(user.id),
  ]);

  return {
    withingsConfigured: Boolean(getWithingsIntegrationConfig()),
    withingsConnection:
      snapshot.connections.find((c) => c.provider === "withings") ?? null,
    pelotonConfigured: hasPelotonServerEnv(),
    pelotonConnection:
      snapshot.connections.find((c) => c.provider === "peloton") ?? null,
    stravaConfigured: Boolean(getStravaIntegrationConfig()),
    stravaConnection:
      snapshot.connections.find((c) => c.provider === "strava") ?? null,
    appleHealthConfigured: hasAppleHealthServerEnv(),
    appleHealthConnection:
      snapshot.connections.find((c) => c.provider === "apple_health") ?? null,
    appleHealthHasWebhookToken,
    appleHealthLastReceived,
    userId: user.id,
    appUrl,
    snapshot,
    flashMessage: buildFlashMessage(input?.status, input?.error),
  };
}
