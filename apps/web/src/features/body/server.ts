import "server-only";

import {
  BodyMetricService,
  buildBodyFatTrend,
  buildBodyMetricSummary,
  buildBodyWaistTrend,
  buildBodyWeightTrend,
} from "@fitness-app/application";
import { SupabaseBodyMetricRepository } from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import type { BodyPageData } from "./types";

async function createBodyMetricService() {
  const client = await createSupabaseRequestClient();
  return new BodyMetricService(new SupabaseBodyMetricRepository(client));
}

export async function getBodyPageData(
  editMetricId?: string,
): Promise<BodyPageData> {
  const user = await requireCurrentUser();
  const bodyMetricService = await createBodyMetricService();
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
