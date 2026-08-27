import { NextRequest, NextResponse } from "next/server";
import { mapWithConcurrency, safeBearerEqual } from "@/lib/server/cron-auth";
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
 * The domain logic (drafting the review, the journal entry, and the AI
 * draft) lives in WeeklyReviewAutoFinalizeService
 * (packages/application/src/modules/weekly-reviews/weekly-review-auto-finalize-service.ts)
 * — this route is intentionally thin: auth check, fetch profiles, then loop
 * with bounded concurrency and aggregate counts. See that service for the
 * per-user behavior and its unit tests.
 *
 * Auth: Bearer token must match CRON_SECRET env var. CRON_SECRET is REQUIRED.
 */
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
    .select("user_id, week_starts_on");

  if (error) {
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
      console.error(
        `[cron/weekly-review-auto-finalize] Failed for user ${rows[i].user_id}:`,
        message,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    drafted,
    skipped,
    errors,
    journalsDrafted,
    aiDrafted,
  });
}
