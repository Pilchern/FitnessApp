import { NextRequest, NextResponse } from "next/server";
import { mapWithConcurrency, safeBearerEqual } from "@/lib/server/cron-auth";
import { createWithingsSyncOrchestrator } from "@/lib/server/integrations";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { getServerEnv, hasWithingsServerEnv } from "@/lib/server/env";

const CONCURRENCY = 3;

/**
 * Weekly cron endpoint — syncs Withings body metrics for all active
 * connections. Mirrors apps/web/src/app/api/cron/peloton-sync/route.ts.
 *
 * Scheduled two ways (both point here, either is sufficient on its own):
 *   1. vercel.json Vercel Cron (weekly-only, no retry semantics).
 *   2. Supabase pg_cron -> pg_net (see
 *      supabase/migrations/20260715160000_add_dead_letter_status_and_retry_sweep.sql),
 *      which also drives the `/api/cron/retry-failed-syncs` sweep every 15
 *      minutes for any run — including ones started from either scheduler —
 *      that ends up `failed`.
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

  if (!hasWithingsServerEnv()) {
    return NextResponse.json({
      skipped: true,
      reason: "Withings not configured",
    });
  }

  const client = createSupabaseAdminClient();

  const { data: connections, error } = await client
    .from("integration_connections")
    .select("user_id")
    .eq("provider", "withings")
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    console.error("[cron/withings-sync] Failed to list connections:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const rows = connections ?? [];

  if (rows.length === 0) {
    return NextResponse.json({
      synced: 0,
      message: "No active Withings connections.",
    });
  }

  const orchestrator = createWithingsSyncOrchestrator();

  const settled = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    await orchestrator.syncBodyMetrics({
      userId: row.user_id,
      provider: "withings",
      triggerType: "scheduled",
    });
    return row.user_id;
  });

  const results = settled.map((res, i) => {
    if (res.status === "fulfilled") {
      return { userId: rows[i].user_id, status: "ok" };
    }
    const message =
      res.reason instanceof Error ? res.reason.message : "Unknown error";
    console.error(
      `[cron/withings-sync] Failed for user ${rows[i].user_id}:`,
      message,
    );
    return { userId: rows[i].user_id, status: "error", error: message };
  });

  return NextResponse.json({ synced: results.length, results });
}
