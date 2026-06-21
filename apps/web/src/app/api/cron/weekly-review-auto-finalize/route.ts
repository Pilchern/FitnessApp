import { NextRequest, NextResponse } from "next/server";
import {
  BodyMetricService,
  CardioSessionService,
  JournalEntryService,
  RecoveryCheckinService,
  StrengthSessionSummaryService,
  WeeklyReviewService,
  buildWeeklyReviewSummary,
  getLastCompletedWeekStart,
  getWeekRangeFromStart,
} from "@fitness-app/application";
import type { WeeklyReviewSummary } from "@fitness-app/domain";
import {
  SupabaseBodyMetricRepository,
  SupabaseCardioSessionRepository,
  SupabaseJournalEntryRepository,
  SupabaseRecoveryCheckinRepository,
  SupabaseStrengthSessionSummaryRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { getServerEnv } from "@/lib/server/env";
import { mapWithConcurrency, safeBearerEqual } from "@/lib/server/cron-utils";

const CONCURRENCY = 3;

type ProfileRow = {
  user_id: string;
  week_starts_on: 0 | 1 | null;
};

function formatDisplayDate(isoDate: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [, monthStr, dayStr] = isoDate.split("-");
  const month = months[parseInt(monthStr, 10) - 1] ?? monthStr;
  const day = parseInt(dayStr, 10);
  return `${month} ${day}`;
}

async function draftJournalEntryForUser(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  profile: ProfileRow,
  prevWeekStartIso: string,
  autoSummary: WeeklyReviewSummary,
): Promise<void> {
  const journalService = new JournalEntryService(
    new SupabaseJournalEntryRepository(adminClient),
  );

  const title = `Week of ${formatDisplayDate(prevWeekStartIso)}`;

  const existing = await journalService.listEntries({
    userId: profile.user_id,
    startDate: prevWeekStartIso,
    endDate: prevWeekStartIso,
    tag: "weekly-reflection",
  });

  if (existing.some((e) => e.title === title)) return;

  const { weekEnd } = getWeekRangeFromStart(prevWeekStartIso);
  const lifts = autoSummary.liftsCompleted ?? 0;
  const cardio = autoSummary.ridesCompleted ?? 0;
  const sleepAvg = autoSummary.sleepAverageHours != null
    ? autoSummary.sleepAverageHours.toFixed(1)
    : "—";
  const readinessAvg = autoSummary.averageReadiness != null
    ? autoSummary.averageReadiness.toFixed(1)
    : "—";

  const body = `Weekly reflection — ${formatDisplayDate(prevWeekStartIso)} to ${formatDisplayDate(weekEnd)}

This week: ${lifts} strength session${lifts !== 1 ? "s" : ""}, ${cardio} cardio session${cardio !== 1 ? "s" : ""}.
Avg readiness: ${readinessAvg}/10. Sleep avg: ${sleepAvg} hrs.

What went well?

What would I do differently?

One thing to focus on next week:`;

  await journalService.create({
    userId: profile.user_id,
    entryDate: prevWeekStartIso,
    title,
    body,
    tags: ["weekly-reflection"],
    relatedWeekStart: prevWeekStartIso,
  });
}

async function draftReviewForUser(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  profile: ProfileRow,
): Promise<{ status: "drafted"; autoSummary: WeeklyReviewSummary; weekStart: string } | { status: "skipped" }> {
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
    return { status: "skipped" as const };
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

  return { status: "drafted" as const, autoSummary, weekStart: prevWeekStartIso };
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
  let journalsDrafted = 0;

  const settled = await mapWithConcurrency(rows, CONCURRENCY, (row) =>
    draftReviewForUser(adminClient, row),
  );

  for (let i = 0; i < settled.length; i++) {
    const res = settled[i];
    if (res.status === "fulfilled") {
      if (res.value.status === "drafted") {
        drafted++;
        try {
          await draftJournalEntryForUser(
            adminClient,
            rows[i],
            res.value.weekStart,
            res.value.autoSummary,
          );
          journalsDrafted++;
        } catch (journalErr) {
          const msg = journalErr instanceof Error ? journalErr.message : "Unknown error";
          console.error(
            `[cron/weekly-review-auto-finalize] Journal draft failed for user ${rows[i].user_id}:`,
            msg,
          );
        }
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

  return NextResponse.json({ ok: true, drafted, skipped, errors, journalsDrafted });
}
