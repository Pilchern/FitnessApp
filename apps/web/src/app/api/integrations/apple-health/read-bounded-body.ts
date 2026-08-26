import type { NextRequest } from "next/server";

/**
 * Largest webhook body accepted, in bytes.
 *
 * Bridge apps post a batch of the last day's records; a few hundred KB is
 * already far past any legitimate payload. The cap exists because reading the
 * body is unavoidably the *first* thing these routes do — HMAC mode has to
 * verify a signature over the raw bytes, so authentication cannot come first —
 * which means an unauthenticated caller controls the allocation.
 */
export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

/**
 * Largest number of records accepted in one webhook post.
 *
 * Each item costs a raw-import-event INSERT plus, in the mapping loop, a
 * find-by-date and an insert or update — all sequential. A payload of tens of
 * thousands of tiny items would run past the platform's function timeout
 * mid-loop, which kills the process before any catch block runs and strands
 * the sync_job_runs row at `running` and the import batch at `processing`
 * forever: the retry sweep only selects `failed`, so nothing ever reclaims
 * them.
 */
export const MAX_WEBHOOK_ITEMS = 500;

export type BoundedBodyResult =
  | { ok: true; rawBody: string }
  | { ok: false; status: number; error: string };

export async function readBoundedWebhookBody(
  request: NextRequest,
): Promise<BoundedBodyResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsed = Number(declaredLength);
    if (Number.isFinite(parsed) && parsed > MAX_WEBHOOK_BODY_BYTES) {
      return {
        ok: false,
        status: 413,
        error: "Request body is too large.",
      };
    }
  }

  const rawBody = await request.text();

  // Content-Length is client-supplied and may be absent (chunked transfer), so
  // the actual byte length is checked too.
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    return { ok: false, status: 413, error: "Request body is too large." };
  }

  return { ok: true, rawBody };
}
