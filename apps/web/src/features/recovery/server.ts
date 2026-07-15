import "server-only";

import {
  buildRecoveryHrvTrend,
  buildRecoveryRestingHeartRateTrend,
  buildRecoverySleepTrend,
  buildRecoverySummary,
  RecoveryCheckinService,
  SupplementLogService,
  SupplementService,
} from "@fitness-app/application";
import {
  SupabaseRecoveryCheckinRepository,
  SupabaseSupplementLogRepository,
  SupabaseSupplementRepository,
} from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import type { RecoveryPageData } from "./types";

async function createRecoveryService() {
  const client = await createSupabaseRequestClient();
  return new RecoveryCheckinService(new SupabaseRecoveryCheckinRepository(client));
}

async function createSupplementService() {
  const client = await createSupabaseRequestClient();
  return new SupplementService(new SupabaseSupplementRepository(client));
}

async function createSupplementLogService() {
  const client = await createSupabaseRequestClient();
  return new SupplementLogService(new SupabaseSupplementLogRepository(client));
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

  const supplementService = await createSupplementService();
  const supplementLogService = await createSupplementLogService();
  const today = todayIsoDate();
  const [activeSupplements, todaysLogs] = await Promise.all([
    supplementService.listActive({ userId: user.id }),
    supplementLogService.listByDate({ userId: user.id, logDate: today }),
  ]);

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
    activeSupplements,
    supplementsTakenToday: todaysLogs
      .filter((log) => log.taken)
      .map((log) => log.supplementId),
    todayIsoDate: today,
  };
}
