import { NextRequest, NextResponse } from "next/server";
import { getZonedDate } from "@fitness-app/application";
import {
  createAppleHealthDailyMetricsOrchestrator,
  createAppleHealthSleepOrchestrator,
  createAppleHealthWebhookSecretLookup,
  createAppleHealthWorkoutOrchestrator,
} from "@/lib/server/integrations";
import { hasAppleHealthServerEnv } from "@/lib/server/env";
import { createCoreServices } from "@/lib/server/services";
import { completeStepHabits } from "@/lib/server/step-habits";
import { formatZonedIsoDate } from "@/features/dashboard/helpers";
import {
  MAX_WEBHOOK_ITEMS,
  readBoundedWebhookBody,
} from "../read-bounded-body";
import { verifyAppleHealthRequest } from "../verify-request";
import { mapShortcutBody, type ShortcutBody } from "../shortcut-payload";

/**
 * Target for the single iPhone Shortcut described in
 * docs/integrations/apple-health-bridge-setup.md. One POST carries today's
 * activity, last night's sleep and recent workouts; this fans it out to the
 * same daily-metrics, sleep and workout orchestrators the other Apple Health
 * webhooks use, then ticks the steps habit.
 *
 * The response echoes what was saved (and any warnings) so that tapping Run
 * in Shortcuts shows whether the setup works.
 *
 * Auth is identical to the other Apple Health webhooks (verify-request.ts):
 *   Authorization: Bearer <per-user webhook token>  + X-User-Id
 */
export async function POST(request: NextRequest) {
  if (!hasAppleHealthServerEnv()) {
    return NextResponse.json(
      { ok: false, error: "Apple Health webhook is not configured." },
      { status: 503 },
    );
  }

  const bounded = await readBoundedWebhookBody(request);
  if (!bounded.ok) {
    return NextResponse.json(
      { ok: false, error: bounded.error },
      { status: bounded.status },
    );
  }

  const auth = await verifyAppleHealthRequest(
    request,
    bounded.rawBody,
    createAppleHealthWebhookSecretLookup(),
  );
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }
  const userId = auth.userId;

  let body: ShortcutBody;
  try {
    body = JSON.parse(bounded.rawBody) as ShortcutBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Body is not JSON. In Get Contents of URL set Request Body to JSON.",
      },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Body must be one JSON dictionary." },
      { status: 400 },
    );
  }

  const { profileService } = await createCoreServices();
  const profile = await profileService.getByUserId(userId);
  const today = formatZonedIsoDate(getZonedDate(profile?.timezone || "UTC"));
  const mapped = mapShortcutBody(body, today);

  if (mapped.workouts.length > MAX_WEBHOOK_ITEMS) {
    return NextResponse.json(
      { ok: false, error: "too_many_workouts" },
      { status: 413 },
    );
  }

  try {
    // Sequential: each orchestrator auto-creates the connection row on first
    // use, and running them in parallel would race on that insert.
    if (mapped.dailyMetrics) {
      await createAppleHealthDailyMetricsOrchestrator().syncDailyMetrics({
        userId,
        triggerType: "webhook",
        items: [mapped.dailyMetrics],
      });
    }
    if (mapped.sleep) {
      await createAppleHealthSleepOrchestrator().syncSleep({
        userId,
        triggerType: "webhook",
        items: [mapped.sleep],
      });
    }
    if (mapped.workouts.length > 0) {
      await createAppleHealthWorkoutOrchestrator().syncWorkouts({
        userId,
        triggerType: "webhook",
        items: mapped.workouts,
      });
    }

    const habitsCompleted = mapped.dailyMetrics
      ? await completeStepHabits(userId, [mapped.dailyMetrics])
      : 0;

    return NextResponse.json({
      ok: true,
      date: mapped.date,
      saved: {
        steps: mapped.dailyMetrics?.steps ?? null,
        resting_heart_rate: mapped.dailyMetrics?.resting_heart_rate ?? null,
        vo2_max: mapped.dailyMetrics?.vo2_max ?? null,
        sleep_minutes: mapped.sleep?.sleep_duration_minutes ?? null,
        hrv: mapped.sleep?.hrv ?? null,
        rides: mapped.workouts.length,
      },
      skippedWorkouts: mapped.skippedWorkouts,
      habitsCompleted,
      warnings: mapped.warnings,
    });
  } catch (error) {
    console.error("[apple-health/shortcut] Sync failed:", error);
    return NextResponse.json(
      { ok: false, error: "sync_failed" },
      { status: 500 },
    );
  }
}
