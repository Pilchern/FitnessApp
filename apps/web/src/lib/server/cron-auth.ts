// Deliberately no `import "server-only"`, matching the other tested pure
// helpers in this directory (get-error-message.ts, parse-action-error.ts) —
// only the feature `server.ts` boundary modules carry that guard, and it does
// not resolve under vitest, which has no config in apps/web. Nothing here
// holds a secret (both are pure functions over their arguments), and the
// node:crypto import already makes a client bundle impossible.
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check of a cron request's `Authorization` header against
 * `CRON_SECRET`.
 *
 * This was six byte-identical private copies, one per cron route, with no
 * tests anywhere. It is the *entire* authentication for those endpoints, and
 * they run under `createSupabaseAdminClient()` — iterating every profile in
 * the database, bypassing RLS. A regression in one of six copies would be an
 * unauthenticated trigger of an admin-scoped job, and nothing would have
 * caught drift between them.
 *
 * The length check is load-bearing, not an optimization: `timingSafeEqual`
 * throws on mismatched buffer lengths.
 */
export function safeBearerEqual(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type CronAuthFailure = {
  status: 401 | 503;
  error: "Unauthorized" | "cron_secret_not_configured";
};

/**
 * The full auth decision for a cron request, as the route returns it: `null`
 * when the request may run, otherwise the status and error body to send.
 *
 * Vercel Cron sends `GET` with `Authorization: Bearer $CRON_SECRET` when the
 * project has a `CRON_SECRET` env var; Supabase pg_cron (trigger_cron_route)
 * sends the same header with `POST`. Both go through here.
 */
export function checkCronAuthorization(
  authHeader: string | null,
  cronSecret: string | undefined,
): CronAuthFailure | null {
  if (!cronSecret) {
    return { status: 503, error: "cron_secret_not_configured" };
  }
  if (!safeBearerEqual(authHeader ?? "", cronSecret)) {
    return { status: 401, error: "Unauthorized" };
  }
  return null;
}

/**
 * Runs `fn` over `items` with at most `limit` in flight, preserving index
 * alignment between `items` and the returned array — the routes index
 * `rows[i]` against `results[i]`, so that correspondence is a contract, not a
 * convenience.
 *
 * Never rejects: a thrown error is captured as a `rejected` result so one bad
 * item can't abort the batch.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= items.length) return;
        try {
          results[idx] = { status: "fulfilled", value: await fn(items[idx]) };
        } catch (err) {
          results[idx] = { status: "rejected", reason: err };
        }
      }
    },
  );
  await Promise.all(workers);
  return results;
}
