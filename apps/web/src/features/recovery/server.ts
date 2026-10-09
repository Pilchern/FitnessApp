import "server-only";

import {
  buildRecoveryHrvTrend,
  buildRecoveryRestingHeartRateTrend,
  buildRecoverySleepTrend,
  buildRecoverySummary,
  getZonedDate,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { formatZonedIsoDate } from "@/features/dashboard/helpers";
import type { RecoveryPageData } from "./types";

export async function getRecoveryPageData(
  editCheckinId?: string,
): Promise<RecoveryPageData> {
  const user = await requireCurrentUser();
  const { recoveryService, supplementService, supplementLogService } =
    await createCoreServices();
  const checkins = await recoveryService.listByDateRange({ userId: user.id });
  const summaryWindow = checkins.slice(0, 7);
  const chartWindow = checkins.slice(0, 30);
  const editingCheckin = editCheckinId
    ? await recoveryService.getById(user.id, editCheckinId)
    : null;

  // The owner's local date, not UTC: dinner and bedtime supplements are ticked
  // after 7 PM Central, when the UTC date is already tomorrow.
  const profile = await getCachedUserProfile(user.id);
  const today = formatZonedIsoDate(getZonedDate(profile?.timezone || "UTC"));
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
    activeSupplements: activeSupplements.filter((s) => s.kind === "supplement"),
    supplementsTakenToday: todaysLogs
      .filter((log) => log.taken)
      .map((log) => log.supplementId),
    todayIsoDate: today,
  };
}
