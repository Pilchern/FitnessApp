import { NextRequest, NextResponse } from "next/server";
import { mapWithConcurrency, safeBearerEqual } from "@/lib/server/cron-auth";
import {
  buildOverridesLookup,
  getWeekRangeFromStart,
} from "@fitness-app/application";
import { getServerEnv } from "@/lib/server/env";
import { createCoreServices } from "@/lib/server/services";
import { createSupabaseAdminClient } from "@/lib/server/supabase";

const CONCURRENCY = 3;

function sixMonthsAgoIsoDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

type ProfileRow = {
  user_id: string;
  timezone: string | null;
};

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const cronSecret = env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "cron_secret_not_configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!safeBearerEqual(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();

  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("user_id, timezone");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (profiles ?? []) as ProfileRow[];

  // Composed once against the admin client and reused across every profile
  // below — these services are stateless wrappers over repositories, so
  // there's no correctness reason to reconstruct them per user like the
  // pre-composition-root version of this route did.
  const {
    weeklyReviewService,
    cardioService,
    recoveryService,
    bodyMetricService,
    strengthService,
    strengthSummaryService,
    exerciseOverrideService,
    insightOrchestrator,
  } = await createCoreServices(adminClient);

  const settled = await mapWithConcurrency(
    rows,
    CONCURRENCY,
    async (profile) => {
      const startDate = sixMonthsAgoIsoDate();
      const timezone = profile.timezone ?? "UTC";

      const [
        weeklyReviews,
        recentCardio,
        recentRecovery,
        recentBody,
        recentStrength,
        exerciseOverrides,
      ] = await Promise.all([
        weeklyReviewService.listRecent(profile.user_id, 8),
        cardioService.listByDateRange({ userId: profile.user_id, startDate }),
        recoveryService.listByDateRange({ userId: profile.user_id, startDate }),
        bodyMetricService.listByDateRange({
          userId: profile.user_id,
          startDate,
        }),
        strengthService.listByDateRange({ userId: profile.user_id, startDate }),
        exerciseOverrideService.listActive({ userId: profile.user_id }),
      ]);

      const weekStarts = new Set(weeklyReviews.map((r) => r.weekStart));
      const liftPairs = await Promise.all(
        [...weekStarts].map(async (weekStart) => {
          const { weekEnd } = getWeekRangeFromStart(weekStart);
          const count = await strengthSummaryService.countCompletedByDateRange({
            userId: profile.user_id,
            startDate: weekStart,
            endDate: weekEnd,
          });
          return [weekStart, count] as const;
        }),
      );

      await insightOrchestrator.generateAndPersist({
        userId: profile.user_id,
        bodyMetrics: recentBody,
        cardioSessions: recentCardio,
        recoveryCheckins: recentRecovery,
        weeklyReviews,
        strengthSessions: recentStrength,
        exerciseOverrides: buildOverridesLookup(exerciseOverrides),
        liftsCompletedByWeek: Object.fromEntries(liftPairs),
        now: new Date(),
        timezone,
      });

      return profile.user_id;
    },
  );

  const results = settled.map((res, i) => {
    if (res.status === "fulfilled") {
      return { userId: rows[i].user_id, ok: true };
    }
    const message =
      res.reason instanceof Error ? res.reason.message : "Unknown error";
    console.error(
      `[cron/insights-generate] Failed for user ${rows[i].user_id}:`,
      message,
    );
    return { userId: rows[i].user_id, ok: false, error: message };
  });

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ processed: results.length, ok, failed, results });
}
