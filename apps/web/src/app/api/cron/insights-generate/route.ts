import { NextRequest, NextResponse } from "next/server";
import {
  AiInsightService,
  BodyMetricService,
  buildInsights,
  CardioSessionService,
  InsightOrchestrator,
  RecoveryCheckinService,
  StrengthSessionSummaryService,
  WeeklyReviewService,
  getWeekRangeFromStart,
} from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseInsightRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseStrengthSessionSummaryRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { getServerEnv } from "@/lib/server/env";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { mapWithConcurrency, safeBearerEqual } from "@/lib/server/cron-utils";

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
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 });
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

  const aiService = env.ANTHROPIC_API_KEY
    ? new AiInsightService({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.INSIGHT_AI_MODEL ?? "claude-haiku-4-5-20251001",
        enabled: env.INSIGHT_AI_ENABLED,
      })
    : null;

  const insightRepo = new SupabaseInsightRepository(adminClient);
  const orchestrator = new InsightOrchestrator(insightRepo, aiService, buildInsights);

  const settled = await mapWithConcurrency(rows, CONCURRENCY, async (profile) => {
    const startDate = sixMonthsAgoIsoDate();
    const timezone = profile.timezone ?? "UTC";

    const [weeklyReviews, recentCardio, recentRecovery, recentBody] = await Promise.all([
      new WeeklyReviewService(
        new SupabaseWeeklyReviewRepository(adminClient),
      ).listRecent(profile.user_id, 8),
      new CardioSessionService(
        new SupabaseCardioSessionRepository(adminClient),
      ).listByDateRange({ userId: profile.user_id, startDate }),
      new RecoveryCheckinService(
        new SupabaseRecoveryCheckinRepository(adminClient),
      ).listByDateRange({ userId: profile.user_id, startDate }),
      new BodyMetricService(
        new SupabaseBodyMetricRepository(adminClient),
      ).listByDateRange({ userId: profile.user_id, startDate }),
    ]);

    const weekStarts = new Set(weeklyReviews.map((r) => r.weekStart));
    const liftPairs = await Promise.all(
      [...weekStarts].map(async (weekStart) => {
        const { weekEnd } = getWeekRangeFromStart(weekStart);
        const count = await new StrengthSessionSummaryService(
          new SupabaseStrengthSessionSummaryRepository(adminClient),
        ).countCompletedByDateRange({
          userId: profile.user_id,
          startDate: weekStart,
          endDate: weekEnd,
        });
        return [weekStart, count] as const;
      }),
    );

    await orchestrator.generateAndPersist({
      userId: profile.user_id,
      bodyMetrics: recentBody,
      cardioSessions: recentCardio,
      recoveryCheckins: recentRecovery,
      weeklyReviews,
      liftsCompletedByWeek: Object.fromEntries(liftPairs),
      now: new Date(),
      timezone,
    });

    return profile.user_id;
  });

  const results = settled.map((res, i) => {
    if (res.status === "fulfilled") {
      return { userId: rows[i].user_id, ok: true };
    }
    const message = res.reason instanceof Error ? res.reason.message : "Unknown error";
    console.error(`[cron/insights-generate] Failed for user ${rows[i].user_id}:`, message);
    return { userId: rows[i].user_id, ok: false, error: message };
  });

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ processed: results.length, ok, failed, results });
}
