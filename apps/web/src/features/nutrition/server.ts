import "server-only";

import {
  buildNutritionAdherenceSummary,
  getZonedDate,
  macroWeek,
  programSettingsFromRows,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import type { NutritionPageData } from "./types";

export async function getNutritionPageData(
  editLogId?: string,
): Promise<NutritionPageData> {
  const user = await requireCurrentUser();
  const { nutritionService, profileService, programService } =
    await createCoreServices();

  const [logs, profile, settingRows] = await Promise.all([
    nutritionService.listByDateRange({ userId: user.id }),
    profileService.getByUserId(user.id),
    programService.listSettings(user.id),
  ]);
  const settings = programSettingsFromRows(settingRows);
  const today = getZonedDate(profile?.timezone || "UTC")
    .toISOString()
    .slice(0, 10);

  const summaryWindow = logs.slice(0, 7);
  const editingLog = editLogId
    ? await nutritionService.getById(user.id, editLogId)
    : null;

  return {
    logs,
    summary: buildNutritionAdherenceSummary(summaryWindow),
    macroWeek: macroWeek(logs, today, {
      calories: profile?.dailyCaloriesTarget ?? null,
      proteinGrams: profile?.dailyProteinGramsTarget ?? null,
      netCarbsGrams: settings.netCarbsTargetG,
      fatGrams: settings.fatTargetG,
      fiberGrams: profile?.dailyFiberGramsTarget ?? null,
    }),
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
