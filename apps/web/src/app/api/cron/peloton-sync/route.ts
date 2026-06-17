import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { createPelotonSyncOrchestrator } from "@/lib/server/integrations";
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

/**
 * Weekly cron endpoint — syncs Peloton rides for all active connections.
 *
 * Vercel Cron: configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/peloton-sync", "schedule": "0 8 * * 1" }] }
 *
 * Auth: Bearer token must match CRON_SECRET env var. CRON_SECRET is REQUIRED.
 */
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

  const client = createSupabaseAdminClient();

  const { data: connections, error } = await client
    .from("integration_connections")
    .select("user_id")
    .eq("provider", "peloton")
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    console.error("[cron/peloton-sync] Failed to list connections:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const rows = connections ?? [];

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0, message: "No active Peloton connections." });
  }

  const orchestrator = createPelotonSyncOrchestrator();

  const settled = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    await orchestrator.syncRides({
      userId: row.user_id,
      provider: "peloton",
      triggerType: "scheduled",
    });
    return row.user_id;
  });

  const results = settled.map((res, i) => {
    if (res.status === "fulfilled") {
      return { userId: rows[i].user_id, status: "ok" };
    }
    const message = res.reason instanceof Error ? res.reason.message : "Unknown error";
    console.error(`[cron/peloton-sync] Failed for user ${rows[i].user_id}:`, message);
    return { userId: rows[i].user_id, status: "error", error: message };
  });

  return NextResponse.json({ synced: results.length, results });
}
