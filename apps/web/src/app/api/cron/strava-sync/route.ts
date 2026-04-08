import { NextRequest, NextResponse } from "next/server";
import { createStravaSyncOrchestrator } from "@/lib/server/integrations";
import { createSupabaseAdminClient } from "@/lib/server/supabase";
import { getServerEnv, hasStravaServerEnv } from "@/lib/server/env";

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const cronSecret = env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

  const results: Array<{ userId: string; ok: boolean; error?: string }> = [];

  for (const row of connections ?? []) {
    try {
      const orchestrator = createStravaSyncOrchestrator();
      await orchestrator.syncRides({
        userId: row.user_id,
        provider: "strava",
        triggerType: "scheduled",
      });
      results.push({ userId: row.user_id, ok: true });
    } catch (err) {
      results.push({
        userId: row.user_id,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
