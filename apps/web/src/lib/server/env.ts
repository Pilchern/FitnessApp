import "server-only";
import { z } from "zod";

const optionalEnvStringSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(1).optional(),
);

const optionalEnvUrlSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().url().optional(),
);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WITHINGS_CLIENT_ID: optionalEnvStringSchema,
  WITHINGS_CLIENT_SECRET: optionalEnvStringSchema,
  WITHINGS_REDIRECT_URI: optionalEnvUrlSchema,
  STRAVA_CLIENT_ID: optionalEnvStringSchema,
  STRAVA_CLIENT_SECRET: optionalEnvStringSchema,
  STRAVA_REDIRECT_URI: optionalEnvUrlSchema,
  INTEGRATION_ENCRYPTION_KEY: optionalEnvStringSchema,
  CRON_SECRET: optionalEnvStringSchema,
  APPLE_HEALTH_WEBHOOK_SECRET: optionalEnvStringSchema,
  ANTHROPIC_API_KEY: optionalEnvStringSchema,
  INSIGHT_AI_MODEL: optionalEnvStringSchema,
  INSIGHT_AI_ENABLED: z.preprocess(
    (v) => v === "true",
    z.boolean().default(false),
  ),
});

let cachedServerEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WITHINGS_CLIENT_ID: process.env.WITHINGS_CLIENT_ID,
    WITHINGS_CLIENT_SECRET: process.env.WITHINGS_CLIENT_SECRET,
    WITHINGS_REDIRECT_URI: process.env.WITHINGS_REDIRECT_URI,
    STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET,
    STRAVA_REDIRECT_URI: process.env.STRAVA_REDIRECT_URI,
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    APPLE_HEALTH_WEBHOOK_SECRET: process.env.APPLE_HEALTH_WEBHOOK_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    INSIGHT_AI_MODEL: process.env.INSIGHT_AI_MODEL,
    INSIGHT_AI_ENABLED: process.env.INSIGHT_AI_ENABLED,
  });

  return cachedServerEnv;
}

export function hasWithingsServerEnv() {
  const env = getServerEnv();

  return Boolean(
    env.WITHINGS_CLIENT_ID &&
      env.WITHINGS_CLIENT_SECRET &&
      env.WITHINGS_REDIRECT_URI &&
      env.INTEGRATION_ENCRYPTION_KEY,
  );
}

export function hasPelotonServerEnv() {
  const env = getServerEnv();
  return Boolean(env.INTEGRATION_ENCRYPTION_KEY);
}

export function hasStravaServerEnv() {
  const env = getServerEnv();
  return Boolean(
    env.STRAVA_CLIENT_ID &&
      env.STRAVA_CLIENT_SECRET &&
      env.STRAVA_REDIRECT_URI &&
      env.INTEGRATION_ENCRYPTION_KEY,
  );
}

export function hasAppleHealthWebhookEnv() {
  const env = getServerEnv();
  return Boolean(env.APPLE_HEALTH_WEBHOOK_SECRET);
}
