"use server";

import { NutritionLogService } from "@fitness-app/application";
import { SupabaseNutritionLogRepository } from "@fitness-app/infrastructure";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { nutritionLogFormSchema } from "./form-schema";
import type { NutritionActionState } from "./types";

function buildNutritionPayload(userId: string, formData: FormData) {
  const parsed = nutritionLogFormSchema.parse({
    id: formData.get("id"),
    logDate: formData.get("logDate"),
    proteinHit: formData.get("proteinHit"),
    mealsOnPlan: formData.get("mealsOnPlan"),
    noPostDinnerSnacking: formData.get("noPostDinnerSnacking"),
    junkLeakage: formData.get("junkLeakage"),
    fiberTaken: formData.get("fiberTaken"),
    alcoholCount: formData.get("alcoholCount"),
    notes: formData.get("notes"),
  });

  return {
    id: parsed.id || undefined,
    userId,
    logDate: parsed.logDate,
    proteinHit: parsed.proteinHit,
    mealsOnPlan: parsed.mealsOnPlan,
    noPostDinnerSnacking: parsed.noPostDinnerSnacking,
    junkLeakage: parsed.junkLeakage,
    fiberTaken: parsed.fiberTaken,
    alcoholCount: parsed.alcoholCount,
    notes: parsed.notes || null,
  };
}

async function createNutritionService() {
  const client = await createSupabaseRequestClient();
  return new NutritionLogService(new SupabaseNutritionLogRepository(client));
}

export async function createNutritionLogAction(
  _previousState: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  try {
    const user = await requireCurrentUser();
    const nutritionService = await createNutritionService();
    await nutritionService.create(buildNutritionPayload(user.id, formData));
    redirect("/nutrition");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function updateNutritionLogAction(
  _previousState: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  try {
    const user = await requireCurrentUser();
    const nutritionService = await createNutritionService();
    const payload = buildNutritionPayload(user.id, formData);

    if (!payload.id) {
      return {
        error: "A log id is required to update nutrition data.",
      };
    }

    await nutritionService.update(payload);
    redirect("/nutrition");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function deleteNutritionLogAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/nutrition");
  }

  let url = "/nutrition";
  try {
    const user = await requireCurrentUser();
    const nutritionService = await createNutritionService();
    await nutritionService.archive(user.id, id);
  } catch (error) {
    url = `/nutrition?error=${encodeURIComponent(
      error instanceof Error ? error.message : "Delete failed.",
    )}`;
  }
  redirect(url);
}
