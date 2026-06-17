import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createStravaSyncOrchestrator } from "@/lib/server/integrations";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { getServerEnv, hasStravaServerEnv } from "@/lib/server/env";

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

  if (!hasStravaServerEnv()) {
    return NextResponse.json({ skipped: true, reason: "Strava not configured" });
  }

  const client = createSupabaseAdminClient();

  const { data: connections, error } = await client
    .from("integration_connections")
    .select("user_id")
    .eq("provider", "strava")
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = connections ?? [];

  const settled = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const orchestrator = createStravaSyncOrchestrator();
    await orchestrator.syncRides({
      userId: row.user_id,
      provider: "strava",
      triggerType: "scheduled",
    });
    return row.user_id;
  });

  const results = settled.map((res, i) => {
    if (res.status === "fulfilled") {
      return { userId: rows[i].user_id, ok: true };
    }
    const message = res.reason instanceof Error ? res.reason.message : "Unknown error";
    console.error(`[cron/strava-sync] Failed for user ${rows[i].user_id}:`, message);
    return { userId: rows[i].user_id, ok: false, error: message };
  });

  return NextResponse.json({ synced: results.length, results });
}
