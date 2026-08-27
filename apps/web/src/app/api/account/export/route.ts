import { NextResponse } from "next/server";
import { createCoreServices } from "@/lib/server/services";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import {
  EXPORT_DATE_RANGE_LIMIT,
  EXPORT_INSIGHT_LIMIT,
  summarizeExportCompleteness,
} from "./export-completeness";

/**
 * Full personal-data export (Step 10: "Exporting user data"). Deliberately
 * excludes anything integration-internal: OAuth tokens
 * (integration_connection_credentials), raw provider payloads
 * (raw_import_events), and sync/job bookkeeping (import_batches,
 * sync_job_runs) — none of that is "your data" in the sense a user asking
 * for an export means, and the credentials table must never leave the
 * server under any circumstance.
 *
 * Every date-range query asks for `EXPORT_DATE_RANGE_LIMIT` rows explicitly:
 * without a `limit` the repositories fall back to
 * `DEFAULT_DATE_RANGE_QUERY_LIMIT` (500) and a "download all my data" file
 * would silently stop at the 500 most recent rows per table. Where a cap
 * still applies (the schema ceiling, or the insights repository's own hard
 * limit), the payload's `completeness` block names the sections that reached
 * it, so a short export is never silent.
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
    limit: EXPORT_DATE_RANGE_LIMIT,
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
    weeklyReviewService.listRecent(user.id, EXPORT_DATE_RANGE_LIMIT),
    nutritionService.listByDateRange(dateRange),
    journalService.listByDateRange(dateRange),
    trainingTemplateService.listActiveStrengthTemplates({ userId: user.id }),
    trainingTemplateService.listActiveCardioTemplates({ userId: user.id }),
    supplementService.listAll({ userId: user.id }),
    supplementLogService.listByDateRange(dateRange),
    dailyActivityService.listByDateRange(dateRange),
    insightRepository.listActive(user.id),
  ]);

  // Only the capped sections are listed here. The remaining sections
  // (profile, training templates, supplements) run unlimited queries, so
  // there is no cap for them to hit. Keys match the payload keys below.
  const rowLimitedSections = {
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    strengthSessions,
    weeklyReviews,
    nutritionLogs,
    journalEntries,
    supplementLogs,
    dailyActivityMetrics,
  };

  const completeness = summarizeExportCompleteness([
    ...Object.entries(rowLimitedSections).map(([section, rows]) => ({
      section,
      rowCount: rows.length,
      limit: EXPORT_DATE_RANGE_LIMIT,
    })),
    {
      section: "insights",
      rowCount: insights.length,
      limit: EXPORT_INSIGHT_LIMIT,
    },
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    userEmail: user.email ?? null,
    completeness,
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
