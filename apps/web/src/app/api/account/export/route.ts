import { NextResponse } from "next/server";
import { createCoreServices } from "@/lib/server/services";
import { createSupabaseRequestClient } from "@/lib/server/supabase";

/**
 * Full personal-data export (Step 10: "Exporting user data"). Deliberately
 * excludes anything integration-internal: OAuth tokens
 * (integration_connection_credentials), raw provider payloads
 * (raw_import_events), and sync/job bookkeeping (import_batches,
 * sync_job_runs) — none of that is "your data" in the sense a user asking
 * for an export means, and the credentials table must never leave the
 * server under any circumstance.
 *
 * Uses the request-scoped (RLS-respecting) client, not the admin client —
 * this is a user-initiated export of their own data, not a background job.
 */

const EPOCH_START_DATE = "1970-01-01";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createSupabaseRequestClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const {
    profileService,
    bodyMetricService,
    cardioService,
    recoveryService,
    strengthService,
    weeklyReviewService,
    nutritionService,
    journalService,
    trainingTemplateService,
    supplementService,
    supplementLogService,
    dailyActivityService,
    insightRepository,
  } = await createCoreServices();

  const dateRange = {
    userId: user.id,
    startDate: EPOCH_START_DATE,
    endDate: todayIsoDate(),
  };

  const [
    profile,
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    strengthSessions,
    weeklyReviews,
    nutritionLogs,
    journalEntries,
    strengthTemplates,
    cardioTemplates,
    supplements,
    supplementLogs,
    dailyActivityMetrics,
    insights,
  ] = await Promise.all([
    profileService.getByUserId(user.id),
    bodyMetricService.listByDateRange(dateRange),
    cardioService.listByDateRange(dateRange),
    recoveryService.listByDateRange(dateRange),
    strengthService.listByDateRange(dateRange),
    weeklyReviewService.listRecent(user.id, 1000),
    nutritionService.listByDateRange(dateRange),
    journalService.listByDateRange(dateRange),
    trainingTemplateService.listActiveStrengthTemplates({ userId: user.id }),
    trainingTemplateService.listActiveCardioTemplates({ userId: user.id }),
    supplementService.listAll({ userId: user.id }),
    supplementLogService.listByDateRange(dateRange),
    dailyActivityService.listByDateRange(dateRange),
    insightRepository.listActive(user.id),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    userEmail: user.email ?? null,
    profile,
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    strengthSessions,
    weeklyReviews,
    nutritionLogs,
    journalEntries,
    trainingTemplates: { strength: strengthTemplates, cardio: cardioTemplates },
    supplements,
    supplementLogs,
    dailyActivityMetrics,
    insights,
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fitnessapp-export-${todayIsoDate()}.json"`,
    },
  });
}
