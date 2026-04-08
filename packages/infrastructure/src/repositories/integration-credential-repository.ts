type StoredIntegrationCredential = {
  connectionId: string;
  userId: string;
  provider: "withings" | "peloton" | "strava" | "apple_health";
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  tokenType: string | null;
  scopes: string[];
};
import type { AppSupabaseClient } from "./shared";
import { decryptSecret, encryptSecret } from "@fitness-app/integrations";
import { z } from "zod";
import { throwOnError } from "./shared";

const integrationCredentialRowSchema = z.object({
  integration_connection_id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: z.enum(["withings", "peloton", "strava", "apple_health"]),
  access_token_encrypted: z.string(),
  refresh_token_encrypted: z.string().nullable(),
  access_token_expires_at: z.string().nullable(),
  refresh_token_expires_at: z.string().nullable(),
  token_type: z.string().nullable(),
  scope: z.array(z.string()).default([]),
});

export class SupabaseIntegrationCredentialRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async save(credential: StoredIntegrationCredential, encryptionKey: string) {
    const response = await this.client
      .from("integration_connection_credentials")
      .upsert(
        {
          integration_connection_id: credential.connectionId,
          user_id: credential.userId,
          provider: credential.provider,
          access_token_encrypted: encryptSecret(
            credential.accessToken,
            encryptionKey,
          ),
          refresh_token_encrypted: credential.refreshToken
            ? encryptSecret(credential.refreshToken, encryptionKey)
            : null,
          access_token_expires_at: credential.accessTokenExpiresAt,
          refresh_token_expires_at: credential.refreshTokenExpiresAt,
          token_type: credential.tokenType,
          scope: credential.scopes,
        },
        {
          onConflict: "integration_connection_id",
        },
      );

    throwOnError(response.error, "Save integration credential");
  }

  async getByConnectionId(connectionId: string, userId: string, encryptionKey: string) {
    const response = await this.client
      .from("integration_connection_credentials")
      .select("*")
      .eq("integration_connection_id", connectionId)
      .eq("user_id", userId)
      .maybeSingle();

    throwOnError(response.error, "Fetch integration credential");

    if (!response.data) {
      return null;
    }

    const row = integrationCredentialRowSchema.parse(response.data);

    return {
      connectionId: row.integration_connection_id,
      userId: row.user_id,
      provider: row.provider,
      accessToken: decryptSecret(row.access_token_encrypted, encryptionKey),
      refreshToken: row.refresh_token_encrypted
        ? decryptSecret(row.refresh_token_encrypted, encryptionKey)
        : null,
      accessTokenExpiresAt: row.access_token_expires_at,
      refreshTokenExpiresAt: row.refresh_token_expires_at,
      tokenType: row.token_type,
      scopes: row.scope,
    };
  }

  async deleteByConnectionId(connectionId: string, userId: string) {
    const response = await this.client
      .from("integration_connection_credentials")
      .delete()
      .eq("integration_connection_id", connectionId)
      .eq("user_id", userId);

    throwOnError(response.error, "Delete integration credential");
  }
}
