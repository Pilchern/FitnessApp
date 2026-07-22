import "server-only";

import {
  evaluateLoginRateLimit,
  type RateLimitAttempt,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "./supabase";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 5;
const RETENTION_MS = 24 * 60 * 60 * 1000;

export type AuthRateLimitAction = "login" | "signup";

function normalizeIdentifier(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Checks whether a login/signup attempt for this email should be allowed
 * right now. Fails open on a lookup error — a transient DB issue should
 * never lock a legitimate user out, only a real run of failed attempts
 * should.
 */
export async function checkLoginRateLimit(
  email: string,
  action: AuthRateLimitAction,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const identifier = normalizeIdentifier(email);
  const windowStart = new Date(
    now.getTime() - WINDOW_MINUTES * 60_000,
  ).toISOString();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("auth_rate_limit_attempts")
    .select("success, attempted_at")
    .eq("identifier", identifier)
    .eq("action", action)
    .gte("attempted_at", windowStart)
    .order("attempted_at", { ascending: true });

  if (error) {
    console.error("[login-rate-limit] Failed to read attempts:", error);
    return { allowed: true };
  }

  const attempts: RateLimitAttempt[] = (data ?? []).map((row) => ({
    success: row.success,
    attemptedAt: row.attempted_at,
  }));

  return evaluateLoginRateLimit(
    attempts,
    { windowMinutes: WINDOW_MINUTES, maxFailures: MAX_FAILURES },
    now,
  );
}

/**
 * Records an attempt and opportunistically prunes this identifier/action's
 * attempts older than the retention window, so the table doesn't grow
 * unbounded without needing a dedicated cleanup cron.
 */
export async function recordLoginAttempt(
  email: string,
  action: AuthRateLimitAction,
  success: boolean,
): Promise<void> {
  const identifier = normalizeIdentifier(email);
  const admin = createSupabaseAdminClient();

  const { error: insertError } = await admin
    .from("auth_rate_limit_attempts")
    .insert({ identifier, action, success });

  if (insertError) {
    console.error("[login-rate-limit] Failed to record attempt:", insertError);
  }

  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  const { error: deleteError } = await admin
    .from("auth_rate_limit_attempts")
    .delete()
    .eq("identifier", identifier)
    .eq("action", action)
    .lt("attempted_at", cutoff);

  if (deleteError) {
    console.error(
      "[login-rate-limit] Failed to prune old attempts:",
      deleteError,
    );
  }
}

export function formatRetryAfter(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
}
