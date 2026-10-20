import { NextRequest, NextResponse } from "next/server";
import {
  checkCronAuthorization,
  mapWithConcurrency,
} from "@/lib/server/cron-auth";
import { startCronHeartbeat } from "@/lib/server/cron-heartbeat";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { createCoreServices } from "@/lib/server/services";
import { getServerEnv } from "@/lib/server/env";

const CONCURRENCY = 3;

type ProfileRow = {
  user_id: string;
  week_starts_on: 0 | 1 | null;
};

/**
 * Weekly cron endpoint — auto-drafts the completed weekly review (plus a
 * "weekly-reflection" journal entry, and an AI draft when configured) for
 * every profile that doesn't already have one for last week.
 *
 * Scheduled by Vercel Cron, Mondays 08:00 UTC, from apps/web/vercel.json.
 * The Vercel project's Root Directory is apps/web, so that is the only
 * vercel.json Vercel reads. Vercel calls with GET; POST is accepted too so
 * pg_cron or a manual curl can run it.
 *
 * The domain logic (drafting the review, the journal entry, and the AI
 * draft) lives in WeeklyReviewAutoFinalizeService
 * (packages/application/src/modules/weekly-reviews/weekly-review-auto-finalize-service.ts)
 * — this route is intentionally thin: auth check, fetch profiles, then loop
 * with bounded concurrency and aggregate counts. See that service for the
 * per-user behavior and its unit tests.
 *
 * Each authorized run leaves a `sync_job_runs` row (job_type
 * `cron_weekly_review_auto_finalize`); see lib/server/cron-heartbeat.ts.
 *
 * Auth: Bearer token must match CRON_SECRET env var. CRON_SECRET is REQUIRED.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const denied = checkCronAuthorization(
    request.headers.get("authorization"),
    env.CRON_SECRET,
  );
  if (denied) {
    return NextResponse.json(
      { error: denied.error },
      { status: denied.status },
    );
  }

  const adminClient = createSupabaseAdminClient();
  const heartbeat = await startCronHeartbeat(
    adminClient,
    "weekly-review-auto-finalize",
  );

  try {
    const { data: profiles, error } = await adminClient
      .from("profiles")
      .select("user_id, week_starts_on");

    if (error) {
      await heartbeat.finish({ ok: false, error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (profiles ?? []) as ProfileRow[];

    const { weeklyReviewAutoFinalizeService } =
      await createCoreServices(adminClient);

    let drafted = 0;
    let skipped = 0;
    let errors = 0;
    let journalsDrafted = 0;
    let aiDrafted = 0;
    let firstError: string | undefined;

    const settled = await mapWithConcurrency(rows, CONCURRENCY, (row) =>
      weeklyReviewAutoFinalizeService.finalizeForUser({
        userId: row.user_id,
        weekStartsOn: row.week_starts_on,
      }),
    );

    for (let i = 0; i < settled.length; i++) {
      const res = settled[i];
      if (res.status === "fulfilled") {
        if (res.value.status === "drafted") {
          drafted++;
          if (res.value.journalDrafted) {
            journalsDrafted++;
          }
        } else {
          skipped++;
        }

        if (res.value.aiDrafted) {
          aiDrafted++;
        }
      } else {
        errors++;
        const message =
          res.reason instanceof Error ? res.reason.message : "Unknown error";
        firstError ??= message;
        console.error(
          `[cron/weekly-review-auto-finalize] Failed for user ${rows[i].user_id}:`,
          message,
        );
      }
    }

    const summary = {
      profiles: rows.length,
      drafted,
      skipped,
      errors,
      journalsDrafted,
      aiDrafted,
    };
    await heartbeat.finish({ ok: errors === 0, summary, error: firstError });

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    await heartbeat.finish({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    throw err;
  }
}

// Same handler for POST (pg_cron's trigger_cron_route, manual runs).
export const POST = GET;
