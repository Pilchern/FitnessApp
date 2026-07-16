import "server-only";

import { randomBytes } from "node:crypto";
import { BodyMetricService, CardioSessionService, IntegrationStatusService } from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseDailyActivityMetricRepository,
  SupabaseImportBatchRepository,
  SupabaseIntegrationConnectionRepository,
  SupabaseIntegrationCredentialRepository,
  SupabaseIntegrationStatusRepository,
  SupabaseRawImportEventRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseSyncJobRunRepository,
} from "@fitness-app/infrastructure";
import { PelotonCardioAdapter, StravaCardioAdapter, WithingsBodyMetricsAdapter } from "@fitness-app/integrations";
import {
  AppleHealthDailyMetricsSyncOrchestrator,
  AppleHealthSleepSyncOrchestrator,
  BodyMetricSyncOrchestrator,
  CardioSyncOrchestrator,
} from "@fitness-app/jobs";
import { getServerEnv, hasAppleHealthServerEnv, hasPelotonServerEnv, hasStravaServerEnv, hasWithingsServerEnv } from "./env";
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
  if (!hasAppleHealthServerEnv()) {
    throw new Error(
      "Apple Health integration is not configured. Add INTEGRATION_ENCRYPTION_KEY to your env.",
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

export function createAppleHealthDailyMetricsOrchestrator() {
  if (!hasAppleHealthServerEnv()) {
    throw new Error(
      "Apple Health integration is not configured. Add INTEGRATION_ENCRYPTION_KEY to your env.",
    );
  }

  const client = createSupabaseAdminClient();

  return new AppleHealthDailyMetricsSyncOrchestrator(
    new SupabaseDailyActivityMetricRepository(client),
    new SupabaseIntegrationConnectionRepository(client),
    new SupabaseSyncJobRunRepository(client),
    new SupabaseImportBatchRepository(client),
    new SupabaseRawImportEventRepository(client),
  );
}

/**
 * Builds the per-user secret lookup function `verifyAppleHealthRequest`
 * needs (see verify-request.ts). Resolves the webhook token for the
 * `X-User-Id` on the incoming request by reading
 * `integration_connection_credentials` with the admin client (RLS is
 * bypassed deliberately here — the request is unauthenticated by
 * definition, so there's no user session to scope an RLS-respecting client
 * to; the per-user secret comparison inside verify-request.ts is what
 * enforces ownership instead).
 */
export function createAppleHealthWebhookSecretLookup() {
  const env = getServerEnv();
  const encryptionKey = env.INTEGRATION_ENCRYPTION_KEY;

  return async (userId: string): Promise<string | null> => {
    if (!encryptionKey) {
      return null;
    }

    const client = createSupabaseAdminClient();
    const credentialRepository = new SupabaseIntegrationCredentialRepository(client);
    const credential = await credentialRepository.getByUserAndProvider(
      userId,
      "apple_health",
      encryptionKey,
    );

    return credential?.accessToken ?? null;
  };
}

/**
 * Generates (or rotates) the caller's Apple Health webhook token. Creates
 * the `apple_health` integration_connections row on first call if one
 * doesn't exist yet (mirrors the auto-creation the sync orchestrators do on
 * first successful webhook), then upserts an
 * integration_connection_credentials row holding the new token, encrypted
 * with INTEGRATION_ENCRYPTION_KEY. Returns the plaintext token once — the
 * caller (a server action) is expected to display it to the user
 * immediately, since it's not persisted in plaintext anywhere.
 *
 * Regenerating overwrites the previous token (rotation semantics, not
 * append) — any bridge app still configured with the old value will start
 * getting 401s until it's updated with the new one. That's an intentional
 * "generate = current token" model rather than a persistent secrets list,
 * to keep this simple.
 */
export async function generateAppleHealthWebhookToken(userId: string): Promise<string> {
  const env = getServerEnv();
  if (!env.INTEGRATION_ENCRYPTION_KEY) {
    throw new Error(
      "Apple Health integration is not configured. Add INTEGRATION_ENCRYPTION_KEY to your env.",
    );
  }

  const client = createSupabaseAdminClient();
  const connectionRepository = new SupabaseIntegrationConnectionRepository(client);
  const credentialRepository = new SupabaseIntegrationCredentialRepository(client);

  let connection = await connectionRepository.getByUserAndProvider(userId, "apple_health");

  if (!connection) {
    connection = await connectionRepository.saveConnection({
      userId,
      provider: "apple_health",
      accountLabel: "Apple Health",
      providerUserId: null,
      scopes: [],
      capabilities: ["sleep", "daily_metrics"],
      metadata: { autoCreated: true },
      status: "active",
    });
  }

  const token = randomBytes(32).toString("base64url");

  await credentialRepository.save(
    {
      connectionId: connection.id,
      userId,
      provider: "apple_health",
      accessToken: token,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      tokenType: "webhook_bearer",
      scopes: [],
    },
    env.INTEGRATION_ENCRYPTION_KEY,
  );

  return token;
}

/**
 * Whether the current user has already generated an Apple Health webhook
 * token — used by the Integrations UI to show "generate" vs. "regenerate"
 * copy without revealing the token value itself.
 */
export async function hasAppleHealthWebhookToken(userId: string): Promise<boolean> {
  const env = getServerEnv();
  if (!env.INTEGRATION_ENCRYPTION_KEY) {
    return false;
  }

  const client = createSupabaseAdminClient();
  const credentialRepository = new SupabaseIntegrationCredentialRepository(client);
  const credential = await credentialRepository.getByUserAndProvider(
    userId,
    "apple_health",
    env.INTEGRATION_ENCRYPTION_KEY,
  );

  return credential != null;
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
