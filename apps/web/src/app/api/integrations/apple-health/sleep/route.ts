import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAppleHealthSleepOrchestrator } from "@/lib/server/integrations";
import { getServerEnv } from "@/lib/server/env";

const appleHealthSleepPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_in_bed_minutes: z.number().optional(),
  sleep_duration_minutes: z.number().optional(),
  deep_sleep_minutes: z.number().optional(),
  rem_sleep_minutes: z.number().optional(),
  core_sleep_minutes: z.number().optional(),
  awake_minutes: z.number().optional(),
  sleep_efficiency_pct: z.number().optional(),
  resting_heart_rate: z.number().optional(),
  hrv: z.number().optional(),
  sleep_hrv_avg: z.number().optional(),
  sleep_avg_heart_rate: z.number().optional(),
  sleep_respiratory_rate: z.number().optional(),
  sleep_spo2_avg_pct: z.number().optional(),
});

// Accept either a JSON array [{...}] or a single object {...} — Shortcuts sends a single object
const appleHealthSleepBodySchema = z.union([
  z.array(appleHealthSleepPayloadSchema),
  appleHealthSleepPayloadSchema.transform((item) => [item]),
]);

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const webhookSecret = env.APPLE_HEALTH_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Apple Health webhook is not configured." },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== webhookSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const userId = request.headers.get("X-User-Id");

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Missing X-User-Id header." },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = appleHealthSleepBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
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
