export type RateLimitAttempt = {
  success: boolean;
  attemptedAt: string;
};

export type RateLimitConfig = {
  windowMinutes: number;
  maxFailures: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Evaluates a rolling-window lockout given a caller-provided list of recent
 * attempts (expected to already be filtered to the lookback window — this
 * function doesn't re-check attemptedAt against `now` beyond ordering them).
 * A successful attempt resets the counter: only failures since the most
 * recent success (within the provided attempts) count toward the lockout,
 * so a user who mistypes their password a few times and then gets in isn't
 * penalized for it afterward.
 */
export function evaluateLoginRateLimit(
  attempts: RateLimitAttempt[],
  config: RateLimitConfig,
  now: Date,
): RateLimitResult {
  const sorted = [...attempts].sort((a, b) =>
    a.attemptedAt.localeCompare(b.attemptedAt),
  );

  const lastSuccessIndex = sorted.reduce(
    (lastIndex, attempt, index) => (attempt.success ? index : lastIndex),
    -1,
  );
  const sinceLastSuccess = sorted.slice(lastSuccessIndex + 1);
  const failures = sinceLastSuccess.filter((attempt) => !attempt.success);

  if (failures.length < config.maxFailures) {
    return { allowed: true };
  }

  // The oldest failure that counts toward the current lockout — once it
  // ages out of the window, the lockout lifts even if no new attempts occur.
  const oldestCountedFailure = failures[failures.length - config.maxFailures];
  const windowEndsAt =
    new Date(oldestCountedFailure.attemptedAt).getTime() +
    config.windowMinutes * 60_000;
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((windowEndsAt - now.getTime()) / 1000),
  );

  return { allowed: false, retryAfterSeconds };
}
