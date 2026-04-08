import "server-only";

import {
  buildRecoveryHrvTrend,
  buildRecoveryRestingHeartRateTrend,
  buildRecoverySleepTrend,
  buildRecoverySummary,
  RecoveryCheckinService,
} from "@fitness-app/application";
import { SupabaseRecoveryCheckinRepository } from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import type { RecoveryPageData } from "./types";

async function createRecoveryService() {
  const client = await createSupabaseRequestClient();
  return new RecoveryCheckinService(new SupabaseRecoveryCheckinRepository(client));
}

export async function getRecoveryPageData(
  editCheckinId?: string,
): Promise<RecoveryPageData> {
  const user = await requireCurrentUser();
  const recoveryService = await createRecoveryService();
  const checkins = await recoveryService.listByDateRange({ userId: user.id });
  const summaryWindow = checkins.slice(0, 7);
  const chartWindow = checkins.slice(0, 30);
  const editingCheckin = editCheckinId
    ? await recoveryService.getById(user.id, editCheckinId)
    : null;

  return {
    checkins,
    summary: buildRecoverySummary(summaryWindow),
    sleepTrend: buildRecoverySleepTrend(chartWindow),
    restingHeartRateTrend: buildRecoveryRestingHeartRateTrend(chartWindow),
    hrvTrend: buildRecoveryHrvTrend(chartWindow),
    editingCheckin,
    formError:
      editCheckinId && !editingCheckin
        ? "The recovery check-in you tried to edit could not be found."
        : undefined,
  };
}
