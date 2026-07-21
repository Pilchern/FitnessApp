import "server-only";

import { buildNutritionAdherenceSummary } from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import type { NutritionPageData } from "./types";

export async function getNutritionPageData(
  editLogId?: string,
): Promise<NutritionPageData> {
  const user = await requireCurrentUser();
  const { nutritionService, profileService } = await createCoreServices();

  const [logs, profile] = await Promise.all([
    nutritionService.listByDateRange({ userId: user.id }),
    profileService.getByUserId(user.id),
  ]);

  const summaryWindow = logs.slice(0, 7);
  const editingLog = editLogId
    ? await nutritionService.getById(user.id, editLogId)
    : null;

  return {
    logs,
    summary: buildNutritionAdherenceSummary(summaryWindow),
    editingLog,
    targets: {
      dailyProteinGramsTarget: profile?.dailyProteinGramsTarget ?? null,
      dailyCaloriesTarget: profile?.dailyCaloriesTarget ?? null,
      dailyFiberGramsTarget: profile?.dailyFiberGramsTarget ?? null,
    },
    formError:
      editLogId && !editingLog
        ? "The nutrition log you tried to edit could not be found."
        : undefined,
  };
}
