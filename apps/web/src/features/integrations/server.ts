import "server-only";

import { headers } from "next/headers";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createIntegrationStatusService,
  getWithingsIntegrationConfig,
  hasAppleHealthWebhookToken,
} from "@/lib/server/integrations";
import { hasAppleHealthServerEnv } from "@/lib/server/env";
import { getCachedUserProfile } from "@/lib/server/services";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import {
  buildAppleHealthStreamStatus,
  buildFlashMessage,
  formatIntegrationDateTime,
  isFailureUnresolved,
  type AppleHealthStream,
} from "./helpers";
import type { IntegrationsPageData } from "./types";

async function getAppUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto =
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}`;
}

const APPLE_HEALTH_JOBS: Record<AppleHealthStream, string> = {
  daily: "apple_health_daily_metrics_sync",
  sleep: "apple_health_sleep_sync",
  workouts: "apple_health_workout_sync",
};

const APPLE_HEALTH_STREAM_LABELS: Record<AppleHealthStream, string> = {
  daily: "Steps and activity",
  sleep: "Sleep",
  workouts: "Rides",
};

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
  return Object.fromEntries(entries) as Record<
    AppleHealthStream,
    string | null
  >;
}

/** Latest failed Apple Health run, whatever the stream. */
async function getAppleHealthLatestFailure(userId: string) {
  const client = createSupabaseAdminClient();
  const { data } = await client
    .from("sync_job_runs")
    .select("job_type, error_message, finished_at, created_at")
    .eq("user_id", userId)
    .in("job_type", Object.values(APPLE_HEALTH_JOBS))
    .in("status", ["failed", "dead_letter"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const stream = (Object.keys(APPLE_HEALTH_JOBS) as AppleHealthStream[]).find(
    (key) => APPLE_HEALTH_JOBS[key] === data.job_type,
  );
  if (!stream) return null;
  return {
    stream,
    at: (data.finished_at as string | null) ?? (data.created_at as string),
    message: (data.error_message as string | null) ?? null,
  };
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
    appleHealthFailure,
    profile,
  ] = await Promise.all([
    service.getSnapshot({ userId: user.id, limit: 8 }),
    getAppUrl(),
    hasAppleHealthWebhookToken(user.id),
    getAppleHealthLastReceived(user.id),
    getAppleHealthLatestFailure(user.id),
    getCachedUserProfile(user.id),
  ]);
  const timeZone = profile?.timezone || "UTC";

  return {
    withingsConfigured: Boolean(getWithingsIntegrationConfig()),
    withingsConnection:
      snapshot.connections.find((c) => c.provider === "withings") ?? null,
    appleHealthConfigured: hasAppleHealthServerEnv(),
    appleHealthConnection:
      snapshot.connections.find((c) => c.provider === "apple_health") ?? null,
    appleHealthHasWebhookToken,
    appleHealthStreams: buildAppleHealthStreamStatus(
      appleHealthLastReceived,
      new Date(),
      timeZone,
    ),
    appleHealthFailure:
      appleHealthFailure &&
      isFailureUnresolved(
        appleHealthFailure.at,
        appleHealthLastReceived[appleHealthFailure.stream],
      )
        ? {
            label: APPLE_HEALTH_STREAM_LABELS[appleHealthFailure.stream],
            at: formatIntegrationDateTime(appleHealthFailure.at, timeZone),
            message: appleHealthFailure.message,
          }
        : null,
    timeZone,
    userId: user.id,
    appUrl,
    snapshot,
    flashMessage: buildFlashMessage(input?.status, input?.error),
  };
}
