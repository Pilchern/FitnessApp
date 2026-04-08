import type { CreateBodyMetricInput, CreateCardioSessionInput } from "@fitness-app/application";
import type { EntityId, IntegrationProvider } from "@fitness-app/domain";

export type OAuthTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  tokenType: string | null;
  scopes: string[];
};

export type OAuthExchangeResult = {
  accountLabel: string | null;
  providerUserId: string | null;
  metadata: Record<string, unknown>;
  tokenSet: OAuthTokenSet;
};

export type StoredProviderCredential = OAuthTokenSet & {
  connectionId: EntityId;
  userId: EntityId;
  provider: IntegrationProvider;
};

export type ProviderRawImportItem<TPayload = Record<string, unknown>> = {
  providerEventType: string;
  providerExternalId: string;
  occurredAt: string | null;
  payload: TPayload;
};

export type ProviderBodyMetricImportPage = {
  items: ProviderRawImportItem[];
  nextCursor: string | null;
  metadata: Record<string, unknown>;
};

export type MappedImportedBodyMetric = Omit<CreateBodyMetricInput, "userId" | "source"> & {
  providerExternalId: string;
};

export type MapRawBodyMetricContext = {
  importBatchId: EntityId;
  rawImportEventId: EntityId;
};

export type ProviderOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type MappedImportedCardioSession = Omit<CreateCardioSessionInput, "userId" | "source"> & {
  providerExternalId: string;
};

export type ProviderCardioImportPage = {
  items: ProviderRawImportItem[];
  nextCursor: string | null;
  metadata: Record<string, unknown>;
};

export interface CardioProviderAdapter {
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly capabilities: string[];
  /**
   * Authenticate with the provider using stored credentials.
   * Returns a short-lived session token to be used for subsequent requests.
   */
  authenticate(input: {
    username: string;
    password: string;
  }): Promise<{ sessionToken: string; providerUserId: string }>;
  fetchCardioSessions(input: {
    sessionToken: string;
    providerUserId: string;
    lastCursor?: string | null;
  }): Promise<ProviderCardioImportPage>;
  mapRawCardioItem(
    item: ProviderRawImportItem,
    context: MapRawBodyMetricContext,
  ): MappedImportedCardioSession | null;
}

export interface OAuthCardioProviderAdapter {
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly capabilities: string[];
  buildAuthorizationUrl(input: { state: string }): string;
  exchangeCode(input: { code: string }): Promise<OAuthExchangeResult>;
  refreshToken(input: { refreshToken: string }): Promise<OAuthTokenSet>;
  fetchCardioSessions(input: {
    accessToken: string;
    providerUserId: string;
    lastCursor?: string | null;
  }): Promise<ProviderCardioImportPage>;
  mapRawCardioItem(
    item: ProviderRawImportItem,
    context: MapRawBodyMetricContext,
  ): MappedImportedCardioSession | null;
}

export interface BodyMetricsProviderAdapter {
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly capabilities: string[];
  buildAuthorizationUrl(input: { state: string }): string;
  exchangeCode(input: { code: string }): Promise<OAuthExchangeResult>;
  refreshToken(input: { refreshToken: string }): Promise<OAuthTokenSet>;
  fetchBodyMetrics(input: {
    accessToken: string;
    lastCursor?: string | null;
  }): Promise<ProviderBodyMetricImportPage>;
  mapRawBodyMetricItem(
    item: ProviderRawImportItem,
    context: MapRawBodyMetricContext,
  ): MappedImportedBodyMetric | null;
}
