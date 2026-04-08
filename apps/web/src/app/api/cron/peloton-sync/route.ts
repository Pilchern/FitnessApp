import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { createPelotonSyncOrchestrator } from "@/lib/server/integrations";
import { getServerEnv } from "@/lib/server/env";

/**
 * Weekly cron endpoint — syncs Peloton rides for all active connections.
 *
 * Vercel Cron: configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/peloton-sync", "schedule": "0 8 * * 1" }] }
 *
 * Auth: Bearer token must match CRON_SECRET env var.
 * Vercel automatically sends the CRON_SECRET as the Authorization header.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const cronSecret = env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const client = createSupabaseAdminClient();

  // Find all active Peloton connections
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

  if (!connections || connections.length === 0) {
    return NextResponse.json({ synced: 0, message: "No active Peloton connections." });
  }

  const orchestrator = createPelotonSyncOrchestrator();
  const results: { userId: string; status: string; error?: string }[] = [];

  for (const { user_id } of connections) {
    try {
      await orchestrator.syncRides({
        userId: user_id,
        provider: "peloton",
        triggerType: "scheduled",
      });
      results.push({ userId: user_id, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[cron/peloton-sync] Failed for user ${user_id}:`, message);
      results.push({ userId: user_id, status: "error", error: message });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
