import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const REPLAY_WINDOW_SECONDS = 300;

export type AppleHealthAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

/**
 * Resolves the webhook secret configured for a given app user id, or `null`
 * if that user hasn't generated one (or doesn't exist). Kept as an injected
 * function rather than a hard Supabase dependency so this module stays unit
 * testable without a real database — see verify-request.test.ts, which
 * passes a plain in-memory mock. The real implementation
 * (`createAppleHealthWebhookSecretLookup` in
 * `apps/web/src/lib/server/integrations.ts`) reads the per-connection token
 * from `integration_connection_credentials`, decrypting it with
 * `INTEGRATION_ENCRYPTION_KEY`.
 */
export type AppleHealthSecretLookup = (
  userId: string,
) => Promise<string | null>;

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function safeEqualUtf8(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies an Apple Health webhook request. Supports two auth modes so a
 * no-code bridge app (Health Auto Export, etc.) that can only send a static
 * custom header can still be automated, while a more capable client can
 * still use the stricter per-request HMAC scheme:
 *
 * 1. Static bearer (recommended for bridge apps): `Authorization: Bearer
 *    <per-user webhook token>` + `X-User-Id`. No per-request signing — most
 *    export apps only support fixed custom headers, not computing a
 *    signature over the outgoing body at send time.
 * 2. HMAC (for scripted/custom clients): `X-User-Id` + `X-Timestamp` +
 *    `X-Signature: sha256=<hex>` where the signature is
 *    HMAC-SHA256(secret, `${userId}.${timestamp}.${rawBody}`), plus a 300s
 *    replay window. Strictly stronger than (1) if your client can compute it.
 *
 * Both modes are checked against a secret scoped to the specific `X-User-Id`
 * presented on the request (resolved via `lookupSecret`), NOT a single
 * app-wide shared secret. This is the fix for a real vulnerability: since
 * `X-User-Id` is fully client-supplied and used verbatim as the write
 * target, a single shared secret would let anyone who knew it (e.g. any
 * second signed-up user, since signup is open) write into an arbitrary
 * other user's sleep/activity data just by guessing or knowing their user
 * id. Requiring the secret that was specifically issued for that user id
 * closes that gap: knowing the secret is no longer sufficient on its own,
 * you must know the secret *issued to the user you're claiming to be*.
 */
export async function verifyAppleHealthRequest(
  request: NextRequest,
  rawBody: string,
  lookupSecret: AppleHealthSecretLookup,
): Promise<AppleHealthAuthResult> {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return { ok: false, status: 401, error: "Missing X-User-Id header." };
  }

  const secret = await lookupSecret(userId);
  if (!secret) {
    // Deliberately the same generic message regardless of whether the user
    // id is unknown or just hasn't generated a webhook token yet — avoids
    // leaking which user ids exist to an unauthenticated caller.
    return {
      ok: false,
      status: 401,
      error: "No Apple Health webhook token configured for this user.",
    };
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;
    if (!safeEqualUtf8(token, secret)) {
      return { ok: false, status: 401, error: "Invalid bearer token." };
    }
    return { ok: true, userId };
  }

  const timestampHeader = request.headers.get("X-Timestamp");
  const signatureHeader = request.headers.get("X-Signature");

  if (!timestampHeader || !signatureHeader) {
    return {
      ok: false,
      status: 401,
      error:
        "Missing auth. Send either Authorization: Bearer <secret>, or X-Timestamp + X-Signature.",
    };
  }

  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, status: 401, error: "Invalid timestamp." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > REPLAY_WINDOW_SECONDS) {
    return {
      ok: false,
      status: 401,
      error: "Timestamp outside replay window.",
    };
  }

  const expectedHex = createHmac("sha256", secret)
    .update(`${userId}.${timestamp}.${rawBody}`)
    .digest("hex");

  const providedHex = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;

  if (!safeEqualHex(expectedHex, providedHex)) {
    return { ok: false, status: 401, error: "Invalid signature." };
  }

  return { ok: true, userId };
}
