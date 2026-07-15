import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAppleHealthDailyMetricsOrchestrator } from "@/lib/server/integrations";
import { getServerEnv } from "@/lib/server/env";

/**
 * Apple Health daily activity metrics webhook.
 *
 * Carries whole-body daytime activity data (steps, VO2 max, non-sleep
 * resting heart rate, exercise minutes, active energy burn) — logically
 * separate from the sleep webhook (`../sleep/route.ts`), which is scoped to
 * overnight sleep-stage and in-sleep vitals data and typically sent once per
 * morning. This endpoint is expected to be sent more frequently (e.g. every
 * few hours or once nightly) since daytime activity accrues throughout the
 * day. Same signing scheme, headers, and orchestration shape as the sleep
 * webhook — see that file for the full security rationale.
 *
 * Headers (required):
 *   X-User-Id     : the canonical user id this payload belongs to.
 *   X-Timestamp   : unix-epoch seconds, replay window = 300s.
 *   X-Signature   : "sha256=<hex>" — HMAC-SHA256 over `${userId}.${timestamp}.${rawBody}`
 *                   using APPLE_HEALTH_WEBHOOK_SECRET. Constant-time compared.
 *
 * Body: a single JSON object or array of objects matching the daily metrics
 * payload schema. `exercise_minutes` is MINUTES — values >1440 are rejected.
 */

const REPLAY_WINDOW_SECONDS = 300;

const appleHealthDailyMetricsPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).optional(),
  vo2_max: z.number().positive().optional(),
  resting_heart_rate: z.number().positive().optional(),
  exercise_minutes: z.number().min(0).max(1440).optional(),
  active_energy_kcal: z.number().min(0).optional(),
});

const appleHealthDailyMetricsBodySchema = z.union([
  z.array(appleHealthDailyMetricsPayloadSchema),
  appleHealthDailyMetricsPayloadSchema.transform((item) => [item]),
]);

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const webhookSecret = env.APPLE_HEALTH_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Apple Health webhook is not configured." },
      { status: 503 },
    );
  }

  const userId = request.headers.get("X-User-Id");
  const timestampHeader = request.headers.get("X-Timestamp");
  const signatureHeader = request.headers.get("X-Signature");

  if (!userId || !timestampHeader || !signatureHeader) {
    return NextResponse.json(
      { ok: false, error: "Missing signature headers." },
      { status: 401 },
    );
  }

  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) {
    return NextResponse.json({ ok: false, error: "Invalid timestamp." }, { status: 401 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > REPLAY_WINDOW_SECONDS) {
    return NextResponse.json({ ok: false, error: "Timestamp outside replay window." }, { status: 401 });
  }

  const rawBody = await request.text();

  const expectedHex = createHmac("sha256", webhookSecret)
    .update(`${userId}.${timestamp}.${rawBody}`)
    .digest("hex");

  const providedHex = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;

  if (!safeEqualHex(expectedHex, providedHex)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = appleHealthDailyMetricsBodySchema.safeParse(body);

  if (!parsed.success) {
    // Don't leak Zod internals to clients; log server-side.
    // eslint-disable-next-line no-console
    console.warn("[apple-health/daily-metrics] invalid payload", parsed.error.flatten());
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const orchestrator = createAppleHealthDailyMetricsOrchestrator();

    const result = await orchestrator.syncDailyMetrics({
      userId,
      triggerType: "webhook",
      items: parsed.data,
    });

    return NextResponse.json({
      ok: true,
      processed: result.processedItemCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
