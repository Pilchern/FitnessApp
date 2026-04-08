import "server-only";

import { BodyMetricService, CardioSessionService, IntegrationStatusService } from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseImportBatchRepository,
  SupabaseIntegrationConnectionRepository,
  SupabaseIntegrationCredentialRepository,
  SupabaseIntegrationStatusRepository,
  SupabaseRawImportEventRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseSyncJobRunRepository,
} from "@fitness-app/infrastructure";
import { PelotonCardioAdapter, StravaCardioAdapter, WithingsBodyMetricsAdapter } from "@fitness-app/integrations";
import { AppleHealthSleepSyncOrchestrator, BodyMetricSyncOrchestrator, CardioSyncOrchestrator } from "@fitness-app/jobs";
import { getServerEnv, hasAppleHealthWebhookEnv, hasPelotonServerEnv, hasStravaServerEnv, hasWithingsServerEnv } from "./env";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "./supabase";

export function getWithingsIntegrationConfig() {
  if (!hasWithingsServerEnv()) {
    return null;
  }

  const env = getServerEnv();

  return {
    clientId: env.WITHINGS_CLIENT_ID!,
    clientSecret: env.WITHINGS_CLIENT_SECRET!,
    redirectUri: env.WITHINGS_REDIRECT_URI!,
    encryptionKey: env.INTEGRATION_ENCRYPTION_KEY!,
  };
}

export function createWithingsAdapter() {
  const config = getWithingsIntegrationConfig();

  if (!config) {
    throw new Error(
      "Withings integration is not configured. Add the Withings OAuth env vars first.",
    );
  }

  return new WithingsBodyMetricsAdapter({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
}

export function createPelotonSyncOrchestrator() {
  if (!hasPelotonServerEnv()) {
    throw new Error(
      "Peloton integration is not configured. Add INTEGRATION_ENCRYPTION_KEY to your env.",
    );
  }

  const env = getServerEnv();
  const client = createSupabaseAdminClient();

  return new CardioSyncOrchestrator(
    new PelotonCardioAdapter(),
    new CardioSessionService(new SupabaseCardioSessionRepository(client)),
    new SupabaseIntegrationConnectionRepository(client),
    new SupabaseIntegrationCredentialRepository(client),
    new SupabaseSyncJobRunRepository(client),
    new SupabaseImportBatchRepository(client),
    new SupabaseRawImportEventRepository(client),
    env.INTEGRATION_ENCRYPTION_KEY!,
  );
}

export function getStravaIntegrationConfig() {
  if (!hasStravaServerEnv()) {
    return null;
  }

  const env = getServerEnv();

  return {
    clientId: env.STRAVA_CLIENT_ID!,
    clientSecret: env.STRAVA_CLIENT_SECRET!,
    redirectUri: env.STRAVA_REDIRECT_URI!,
    encryptionKey: env.INTEGRATION_ENCRYPTION_KEY!,
  };
}

export function createStravaAdapter() {
  const config = getStravaIntegrationConfig();

  if (!config) {
    throw new Error(
      "Strava integration is not configured. Add the Strava OAuth env vars first.",
    );
  }

  return new StravaCardioAdapter({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
}

export function createStravaSyncOrchestrator() {
  const config = getStravaIntegrationConfig();

  if (!config) {
    throw new Error(
      "Strava integration is not configured. Add the Strava OAuth env vars first.",
    );
  }

  const client = createSupabaseAdminClient();

  return new CardioSyncOrchestrator(
    createStravaAdapter(),
    new CardioSessionService(new SupabaseCardioSessionRepository(client)),
    new SupabaseIntegrationConnectionRepository(client),
    new SupabaseIntegrationCredentialRepository(client),
    new SupabaseSyncJobRunRepository(client),
    new SupabaseImportBatchRepository(client),
    new SupabaseRawImportEventRepository(client),
    config.encryptionKey,
  );
}

export function createAppleHealthSleepOrchestrator() {
  if (!hasAppleHealthWebhookEnv()) {
    throw new Error(
      "Apple Health integration is not configured. Add APPLE_HEALTH_WEBHOOK_SECRET to your env.",
    );
  }

  const client = createSupabaseAdminClient();

  return new AppleHealthSleepSyncOrchestrator(
    new SupabaseRecoveryCheckinRepository(client),
    new SupabaseIntegrationConnectionRepository(client),
    new SupabaseSyncJobRunRepository(client),
    new SupabaseImportBatchRepository(client),
    new SupabaseRawImportEventRepository(client),
  );
}

export async function createIntegrationStatusService() {
  const client = await createSupabaseRequestClient();
  return new IntegrationStatusService(new SupabaseIntegrationStatusRepository(client));
}

export function createWithingsSyncOrchestrator() {
  const config = getWithingsIntegrationConfig();

  if (!config) {
    throw new Error(
      "Withings integration is not configured. Add the Withings OAuth env vars first.",
    );
  }

  const client = createSupabaseAdminClient();
  const bodyMetricService = new BodyMetricService(
    new SupabaseBodyMetricRepository(client),
  );

  return new BodyMetricSyncOrchestrator(
    new WithingsBodyMetricsAdapter({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    }),
    bodyMetricService,
    new SupabaseIntegrationConnectionRepository(client),
    new SupabaseIntegrationCredentialRepository(client),
    new SupabaseSyncJobRunRepository(client),
    new SupabaseImportBatchRepository(client),
    new SupabaseRawImportEventRepository(client),
    config.encryptionKey,
  );
}
