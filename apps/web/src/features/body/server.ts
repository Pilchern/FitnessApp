import "server-only";

import {
  buildBodyFatTrend,
  buildBodyMetricSummary,
  buildBodyWaistTrend,
  buildBodyWeightTrend,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import type { BodyPageData } from "./types";

export async function getBodyPageData(
  editMetricId?: string,
): Promise<BodyPageData> {
  const user = await requireCurrentUser();
  const { bodyMetricService } = await createCoreServices();
  const metrics = await bodyMetricService.listByDateRange({ userId: user.id });
  const chartWindow = metrics.slice(0, 12);
  const editingMetric = editMetricId
    ? await bodyMetricService.getById(user.id, editMetricId)
    : null;

  return {
    metrics,
    summary: buildBodyMetricSummary(metrics),
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
