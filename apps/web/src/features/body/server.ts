import "server-only";

import {
  buildBodyFatTrend,
  buildBodyMetricSummary,
  buildBodyWaistTrend,
  buildBodyWeightTrend,
  buildWeeklyWeightTrend,
  getZonedDate,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import type { BodyPageData } from "./types";

export async function getBodyPageData(
  editMetricId?: string,
): Promise<BodyPageData> {
  const user = await requireCurrentUser();
  const { bodyMetricService } = await createCoreServices();
  const [metrics, profile] = await Promise.all([
    bodyMetricService.listByDateRange({ userId: user.id }),
    getCachedUserProfile(user.id),
  ]);
  // getZonedDate's UTC fields hold the user's local date (see dashboard).
  const today = getZonedDate(profile?.timezone || "UTC")
    .toISOString()
    .slice(0, 10);
  const chartWindow = metrics.slice(0, 12);
  const editingMetric = editMetricId
    ? await bodyMetricService.getById(user.id, editMetricId)
    : null;

  return {
    metrics,
    summary: buildBodyMetricSummary(metrics),
    weeklyWeight: buildWeeklyWeightTrend(metrics, today),
    weightTrend: buildBodyWeightTrend(chartWindow),
    waistTrend: buildBodyWaistTrend(chartWindow),
    bodyFatTrend: buildBodyFatTrend(chartWindow),
    editingMetric,
    formError:
      editMetricId && !editingMetric
        ? "The body metric entry you tried to edit could not be found."
        : undefined,
  };
}
