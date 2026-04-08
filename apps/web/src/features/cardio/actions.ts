"use server";

import { CardioSessionService } from "@fitness-app/application";
import { SupabaseCardioSessionRepository } from "@fitness-app/infrastructure";
import { redirect } from "next/navigation";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { cardioSessionFormSchema } from "./form-schema";
import type { CardioActionState } from "./types";

function buildCardioPayload(
  userId: string,
  formData: FormData,
) {
  const parsed = cardioSessionFormSchema.parse({
    id: formData.get("id"),
    trainingTemplateId: formData.get("trainingTemplateId"),
    sessionDate: formData.get("sessionDate"),
    sessionKind: formData.get("sessionKind"),
    plannedVsCompleted: formData.get("plannedVsCompleted"),
    durationMinutes: formData.get("durationMinutes"),
    avgHeartRate: formData.get("avgHeartRate"),
    maxHeartRate: formData.get("maxHeartRate"),
    avgOutput: formData.get("avgOutput"),
    cadenceMin: formData.get("cadenceMin"),
    cadenceMax: formData.get("cadenceMax"),
    resistanceMin: formData.get("resistanceMin"),
    resistanceMax: formData.get("resistanceMax"),
    intervalStructure: formData.get("intervalStructure"),
    rpe: formData.get("rpe"),
    notes: formData.get("notes"),
  });

  const zone2Minutes =
    parsed.sessionKind === "zone2" ? parsed.durationMinutes ?? null : null;

  return {
    id: parsed.id || undefined,
    userId,
    trainingTemplateId: parsed.trainingTemplateId || null,
    sessionDate: parsed.sessionDate,
    sessionKind: parsed.sessionKind,
    plannedVsCompleted: parsed.plannedVsCompleted,
    durationMinutes: parsed.durationMinutes,
    zone2Minutes,
    avgHeartRate: parsed.avgHeartRate,
    maxHeartRate: parsed.maxHeartRate,
    avgOutput: parsed.avgOutput,
    cadenceMin: parsed.cadenceMin,
    cadenceMax: parsed.cadenceMax,
    resistanceMin: parsed.resistanceMin,
    resistanceMax: parsed.resistanceMax,
    intervalStructure: parsed.intervalStructure || null,
    rpe: parsed.rpe,
    notes: parsed.notes || null,
    source: {
      sourceType: "manual" as const,
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    },
  };
}

async function createCardioService() {
  const client = await createSupabaseRequestClient();
  return new CardioSessionService(new SupabaseCardioSessionRepository(client));
}

export async function createCardioSessionAction(
  _previousState: CardioActionState,
  formData: FormData,
): Promise<CardioActionState> {
  try {
    const user = await requireCurrentUser();
    const cardioService = await createCardioService();
    const payload = buildCardioPayload(user.id, formData);
    await cardioService.create(payload);
    redirect("/cardio");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function updateCardioSessionAction(
  _previousState: CardioActionState,
  formData: FormData,
): Promise<CardioActionState> {
  try {
    const user = await requireCurrentUser();
    const cardioService = await createCardioService();
    const payload = buildCardioPayload(user.id, formData);
    if (!payload.id) {
      return {
        error: "A session id is required to update a ride.",
      };
    }

    await cardioService.update(payload);
    redirect("/cardio");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function deleteCardioSessionAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/cardio");
  }

  let url = "/cardio";
  try {
    const user = await requireCurrentUser();
    const cardioService = await createCardioService();
    await cardioService.archive(user.id, id);
  } catch (error) {
    url = `/cardio?error=${encodeURIComponent(error instanceof Error ? error.message : "Delete failed.")}`;
  }
  redirect(url);
}
