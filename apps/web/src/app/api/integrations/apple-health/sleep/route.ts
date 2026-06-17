import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAppleHealthSleepOrchestrator } from "@/lib/server/integrations";
import { getServerEnv } from "@/lib/server/env";

/**
 * Apple Health sleep webhook.
 *
 * Headers (required):
 *   X-User-Id     : the canonical user id this payload belongs to.
 *   X-Timestamp   : unix-epoch seconds, replay window = 300s.
 *   X-Signature   : "sha256=<hex>" — HMAC-SHA256 over `${userId}.${timestamp}.${rawBody}`
 *                   using APPLE_HEALTH_WEBHOOK_SECRET. Constant-time compared.
 *
 * Body: a single JSON object or array of objects matching the sleep payload
 * schema. All `*_minutes` fields are MINUTES — values >1440 are rejected.
 */

const REPLAY_WINDOW_SECONDS = 300;

const minutesField = z.number().min(0).max(1440);

const appleHealthSleepPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_in_bed_minutes: minutesField.optional(),
  sleep_duration_minutes: minutesField.optional(),
  deep_sleep_minutes: minutesField.optional(),
  rem_sleep_minutes: minutesField.optional(),
  core_sleep_minutes: minutesField.optional(),
  awake_minutes: minutesField.optional(),
  sleep_efficiency_pct: z.number().min(0).max(100).optional(),
  resting_heart_rate: z.number().optional(),
  hrv: z.number().optional(),
  sleep_hrv_avg: z.number().optional(),
  sleep_avg_heart_rate: z.number().optional(),
  sleep_respiratory_rate: z.number().optional(),
  sleep_spo2_avg_pct: z.number().min(0).max(100).optional(),
});

const appleHealthSleepBodySchema = z.union([
  z.array(appleHealthSleepPayloadSchema),
  appleHealthSleepPayloadSchema.transform((item) => [item]),
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

  const parsed = appleHealthSleepBodySchema.safeParse(body);

  if (!parsed.success) {
    // Don't leak Zod internals to clients; log server-side.
    // eslint-disable-next-line no-console
    console.warn("[apple-health/sleep] invalid payload", parsed.error.flatten());
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const orchestrator = createAppleHealthSleepOrchestrator();

    const result = await orchestrator.syncSleep({
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
