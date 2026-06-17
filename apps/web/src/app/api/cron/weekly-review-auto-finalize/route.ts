import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  BodyMetricService,
  CardioSessionService,
  RecoveryCheckinService,
  StrengthSessionSummaryService,
  WeeklyReviewService,
  buildWeeklyReviewSummary,
  getLastCompletedWeekStart,
  getWeekRangeFromStart,
} from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseStrengthSessionSummaryRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { getServerEnv } from "@/lib/server/env";

const CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      try {
        results[idx] = { status: "fulfilled", value: await fn(items[idx]) };
      } catch (err) {
        results[idx] = { status: "rejected", reason: err };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function safeBearerEqual(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type ProfileRow = {
  user_id: string;
  week_starts_on: 0 | 1 | null;
};

async function draftReviewForUser(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  profile: ProfileRow,
): Promise<"drafted" | "skipped"> {
  const weekStartsOn = (profile.week_starts_on ?? 1) as 0 | 1;
  const prevWeekStartIso = getLastCompletedWeekStart(new Date(), weekStartsOn);

  const { weekEnd: prevWeekEndIso } = getWeekRangeFromStart(prevWeekStartIso);

  const weeklyReviewService = new WeeklyReviewService(
    new SupabaseWeeklyReviewRepository(adminClient),
  );

  const existing = await weeklyReviewService.getByWeekStart({
    userId: profile.user_id,
    weekStart: prevWeekStartIso,
  });

  if (existing) {
    return "skipped";
  }

  const dateRangeQuery = {
    userId: profile.user_id,
    startDate: prevWeekStartIso,
    endDate: prevWeekEndIso,
  };

  const bodyMetricService = new BodyMetricService(
    new SupabaseBodyMetricRepository(adminClient),
  );
  const cardioService = new CardioSessionService(
    new SupabaseCardioSessionRepository(adminClient),
  );
  const recoveryService = new RecoveryCheckinService(
    new SupabaseRecoveryCheckinRepository(adminClient),
  );
  const strengthSummaryService = new StrengthSessionSummaryService(
    new SupabaseStrengthSessionSummaryRepository(adminClient),
  );

  const [bodyMetrics, cardioSessions, recoveryCheckins, liftsCompleted] =
    await Promise.all([
      bodyMetricService.listByDateRange(dateRangeQuery),
      cardioService.listByDateRange(dateRangeQuery),
      recoveryService.listByDateRange(dateRangeQuery),
      strengthSummaryService.countCompletedByDateRange(dateRangeQuery),
    ]);

  const autoSummary = buildWeeklyReviewSummary({
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    liftsCompleted,
  });

  await weeklyReviewService.create({
    userId: profile.user_id,
    weekStart: prevWeekStartIso,
    weekEnd: prevWeekEndIso,
    status: "draft",
    summary: autoSummary,
    bestWin: null,
    biggestMiss: null,
    lesson: null,
    nextWeekPriority: null,
    confidence: null,
    scoreDetails: null,
    strategicDecision: null,
    riskForecast: null,
    manualOverrides: {},
    completedAt: null,
  });

  return "drafted";
}

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
    .select("user_id, week_starts_on");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (profiles ?? []) as ProfileRow[];

  let drafted = 0;
  let skipped = 0;
  let errors = 0;

  const settled = await mapWithConcurrency(rows, CONCURRENCY, (row) =>
    draftReviewForUser(adminClient, row),
  );

  for (let i = 0; i < settled.length; i++) {
    const res = settled[i];
    if (res.status === "fulfilled") {
      if (res.value === "drafted") {
        drafted++;
      } else {
        skipped++;
      }
    } else {
      errors++;
      const message = res.reason instanceof Error ? res.reason.message : "Unknown error";
      console.error(
        `[cron/weekly-review-auto-finalize] Failed for user ${rows[i].user_id}:`,
        message,
      );
    }
  }

  return NextResponse.json({ ok: true, drafted, skipped, errors });
}
