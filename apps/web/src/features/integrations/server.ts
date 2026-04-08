import "server-only";

import { headers } from "next/headers";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createIntegrationStatusService,
  getStravaIntegrationConfig,
  getWithingsIntegrationConfig,
} from "@/lib/server/integrations";
import { hasPelotonServerEnv, hasAppleHealthWebhookEnv } from "@/lib/server/env";
import { buildFlashMessage } from "./helpers";
import type { IntegrationsPageData } from "./types";

async function getAppUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function getIntegrationsPageData(input?: {
  status?: string;
  error?: string;
}): Promise<IntegrationsPageData> {
  const user = await requireCurrentUser();
  const service = await createIntegrationStatusService();
  const [snapshot, appUrl] = await Promise.all([
    service.getSnapshot({ userId: user.id, limit: 8 }),
    getAppUrl(),
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
    appleHealthConfigured: hasAppleHealthWebhookEnv(),
    appleHealthConnection:
      snapshot.connections.find((c) => c.provider === "apple_health") ?? null,
    userId: user.id,
    appUrl,
    snapshot,
    flashMessage: buildFlashMessage(input?.status, input?.error),
  };
}
