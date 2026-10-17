import { NextRequest, NextResponse } from "next/server";
import {
  createAppleHealthDailyMetricsOrchestrator,
  createAppleHealthSleepOrchestrator,
  createAppleHealthWebhookSecretLookup,
  createAppleHealthWorkoutOrchestrator,
} from "@/lib/server/integrations";
import { hasAppleHealthServerEnv } from "@/lib/server/env";
import {
  completeDaylightHabits,
  completeStepHabits,
} from "@/lib/server/step-habits";
import { getCachedUserProfile } from "@/lib/server/services";
import {
  ageOn,
  zone2HeartRateRange,
  zone2PowerRange,
} from "@fitness-app/application";
import { syncWatchStrength } from "@/lib/server/watch-strength";
import {
  MAX_WEBHOOK_ITEMS,
  readBoundedWebhookBody,
} from "../read-bounded-body";
import { verifyAppleHealthRequest } from "../verify-request";
import {
  mapHealthAutoExport,
  type HealthAutoExportBody,
} from "../health-auto-export";

/**
 * Health Auto Export (iOS) REST automation target. Accepts that app's native
 * JSON ({ data: { metrics, workouts } }) and fans it out to the same three
 * orchestrators the sleep, daily-metrics and workouts webhooks use, so one
 * phone-side automation covers all three. Mapping rules (rides only, no
 * weight, overlapping rides deduped, Watch strength workouts merged into
 * the day's lift session) live in ../health-auto-export.ts.
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
  const rawBody = bounded.rawBody;

  const lookupSecret = createAppleHealthWebhookSecretLookup();
  const auth = await verifyAppleHealthRequest(request, rawBody, lookupSecret);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }
  const userId = auth.userId;

  let body: HealthAutoExportBody;
  try {
    body = JSON.parse(rawBody) as HealthAutoExportBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || typeof body.data !== "object") {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 },
    );
  }

  // Zone 2 by power when a ride carries it, else by the heart rate band from
  // the profile's age; without either a ride counts its full duration.
  const profile = await getCachedUserProfile(userId).catch(() => null);
  const today = new Date().toISOString().slice(0, 10);
  const mapped = mapHealthAutoExport(body, {
    zone2Bpm: profile?.birthDate
      ? zone2HeartRateRange(ageOn(profile.birthDate, today))
      : null,
    zone2Watts: zone2PowerRange(),
  });
  if (
    mapped.dailyMetrics.length > MAX_WEBHOOK_ITEMS ||
    mapped.sleep.length > MAX_WEBHOOK_ITEMS ||
    mapped.workouts.length > MAX_WEBHOOK_ITEMS ||
    mapped.strengthWorkouts.length > MAX_WEBHOOK_ITEMS
  ) {
    return NextResponse.json(
      { ok: false, error: "too_many_items" },
      { status: 413 },
    );
  }

  try {
    // Sequential: each orchestrator auto-creates the connection row on first
    // use, and running them in parallel would race on that insert.
    const daily =
      mapped.dailyMetrics.length > 0
        ? await createAppleHealthDailyMetricsOrchestrator().syncDailyMetrics({
            userId,
            triggerType: "webhook",
            items: mapped.dailyMetrics,
          })
        : null;
    const sleep =
      mapped.sleep.length > 0
        ? await createAppleHealthSleepOrchestrator().syncSleep({
            userId,
            triggerType: "webhook",
            items: mapped.sleep,
          })
        : null;
    const workouts =
      mapped.workouts.length > 0
        ? await createAppleHealthWorkoutOrchestrator().syncWorkouts({
            userId,
            triggerType: "webhook",
            items: mapped.workouts,
          })
        : null;

    const habitsCompleted = await completeStepHabits(
      userId,
      mapped.dailyMetrics,
    );

    const daylightHabitsCompleted = await completeDaylightHabits(
      userId,
      mapped.morningDaylight,
    );

    const strengthMerged = await syncWatchStrength(
      userId,
      mapped.strengthWorkouts,
    );

    return NextResponse.json({
      ok: true,
      dailyMetrics: daily?.processedItemCount ?? 0,
      sleep: sleep?.processedItemCount ?? 0,
      workouts: workouts?.processedItemCount ?? 0,
      habitsCompleted: habitsCompleted + daylightHabitsCompleted,
      strengthMerged,
    });
  } catch (error) {
    console.error("[apple-health/health-auto-export] Sync failed:", error);
    return NextResponse.json(
      { ok: false, error: "sync_failed" },
      { status: 500 },
    );
  }
}
