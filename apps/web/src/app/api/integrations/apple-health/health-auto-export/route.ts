import { NextRequest, NextResponse } from "next/server";
import {
  createAppleHealthDailyMetricsOrchestrator,
  createAppleHealthNutritionOrchestrator,
  createAppleHealthSleepOrchestrator,
  createAppleHealthWebhookSecretLookup,
  createAppleHealthWorkoutOrchestrator,
  createOvernightMetricsService,
} from "@/lib/server/integrations";
import { hasAppleHealthServerEnv } from "@/lib/server/env";
import {
  completeDaylightHabits,
  completeStepHabits,
} from "@/lib/server/step-habits";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import {
  ageOn,
  ZONE2_CREDIT_BY,
  maxHeartRateFor,
  MEASURED_MAX_HEART_RATE,
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
  type WalkingDay,
  walkingDaysFromTests,
  walkingWindows,
} from "../health-auto-export";

const DAILY_TYPES = ["walking_asymmetry_daily", "walking_speed_daily"] as const;

function shiftIso(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function walkingRows(
  date: string,
  asymType: string,
  speedType: string,
  asym: number | null,
  speed: number | null,
  notes: string | null,
) {
  return [
    ...(asym != null
      ? [
          {
            testDate: date,
            testType: asymType,
            side: null,
            value: asym,
            unit: "%",
            repIndex: 1,
            notes,
          },
        ]
      : []),
    ...(speed != null
      ? [
          {
            testDate: date,
            testType: speedType,
            side: null,
            value: speed,
            unit: "m/s",
            repIndex: 1,
            notes,
          },
        ]
      : []),
  ];
}

/**
 * Walking asymmetry and speed into knee_tests, source 'apple_health', where
 * the knee gates and weekly review read them. Each day in the payload is
 * stored as a *_daily row; the 7-day mean for those dates is then built from
 * the stored days (any source, apple_health first), because Health Auto
 * Export sends 1-2 days per run and splits a manual export into one request
 * per day. Fails soft: a walking error is logged and never fails the rest of
 * the sync.
 */
async function syncWalking(userId: string, days: WalkingDay[]) {
  if (days.length === 0) return 0;
  try {
    const { programService } = await createCoreServices();
    for (const d of days) {
      await programService.replaceKneeTests({
        userId,
        source: "apple_health",
        testDate: d.date,
        replaceTypes: [...DAILY_TYPES],
        rows: walkingRows(
          d.date,
          "walking_asymmetry_daily",
          "walking_speed_daily",
          d.asymmetryPct,
          d.speedMps,
          null,
        ),
      });
    }
    const dates = days.map((d) => d.date).sort();
    const tests = await programService.listKneeTests(
      userId,
      shiftIso(dates[0]!, -6),
      dates[dates.length - 1]!,
    );
    const readings = walkingWindows(walkingDaysFromTests(tests), dates);
    for (const r of readings) {
      await programService.replaceKneeTests({
        userId,
        source: "apple_health",
        testDate: r.date,
        replaceTypes: ["walking_asymmetry", "walking_speed"],
        rows: walkingRows(
          r.date,
          "walking_asymmetry",
          "walking_speed",
          r.asymmetryPct,
          r.speedMps,
          `7-day mean, ${r.days} days`,
        ),
      });
    }
    return readings.length;
  } catch (error) {
    console.error(
      "[apple-health/health-auto-export] Walking sync failed:",
      error,
    );
    return 0;
  }
}

/**
 * Health Auto Export (iOS) REST automation target. Accepts that app's native
 * JSON ({ data: { metrics, workouts } }) and fans it out to the same three
 * orchestrators the sleep, daily-metrics and workouts webhooks use, so one
 * phone-side automation covers all three. Dietary metrics (dietary_energy,
 * protein, carbohydrates, total_fat, fiber) go to the nutrition sync, which
 * writes nutrition_logs. Mapping rules (rides only, no weight, overlapping
 * rides deduped, Watch strength workouts merged into the day's lift session)
 * live in ../health-auto-export.ts.
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

  // Heart rate band from the measured max HR, else the profile's age. A
  // failed profile lookup must not drop the band while max HR is measured.
  const today = new Date().toISOString().slice(0, 10);
  const birthDate =
    MEASURED_MAX_HEART_RATE == null
      ? ((await getCachedUserProfile(userId).catch(() => null))?.birthDate ??
        null)
      : null;
  const maxHeartRate =
    MEASURED_MAX_HEART_RATE ??
    (birthDate ? maxHeartRateFor(ageOn(birthDate, today)) : null);
  const mapped = mapHealthAutoExport(body, {
    zone2Bpm: maxHeartRate != null ? zone2HeartRateRange(maxHeartRate) : null,
    zone2Watts: zone2PowerRange(),
    zone2CreditBy: ZONE2_CREDIT_BY,
  });
  if (
    mapped.dailyMetrics.length > MAX_WEBHOOK_ITEMS ||
    mapped.sleep.length > MAX_WEBHOOK_ITEMS ||
    mapped.workouts.length > MAX_WEBHOOK_ITEMS ||
    mapped.strengthWorkouts.length > MAX_WEBHOOK_ITEMS ||
    mapped.nutrition.length > MAX_WEBHOOK_ITEMS ||
    mapped.walking.length > MAX_WEBHOOK_ITEMS
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
    // After the sleep sync, so a night's bedtime and wake are on the row.
    // Whichever of the two automations lands second sees both.
    const overnight =
      mapped.overnightSamples.length > 0 || mapped.sleep.length > 0
        ? await createOvernightMetricsService().sync(
            userId,
            mapped.overnightSamples,
            mapped.sleep.map((s) => s.date),
          )
        : 0;
    const workouts =
      mapped.workouts.length > 0
        ? await createAppleHealthWorkoutOrchestrator().syncWorkouts({
            userId,
            triggerType: "webhook",
            items: mapped.workouts,
          })
        : null;

    const nutrition =
      mapped.nutrition.length > 0
        ? await createAppleHealthNutritionOrchestrator().syncNutrition({
            userId,
            triggerType: "webhook",
            items: mapped.nutrition,
          })
        : null;

    const walking = await syncWalking(userId, mapped.walking);

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
      overnightNights: overnight,
      workouts: workouts?.processedItemCount ?? 0,
      nutrition: nutrition?.processedItemCount ?? 0,
      walking,
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
