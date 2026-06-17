"use server";

import { RecoveryCheckinService } from "@fitness-app/application";
import { SupabaseRecoveryCheckinRepository } from "@fitness-app/infrastructure";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { recoveryCheckinFormSchema } from "./form-schema";
import type { RecoveryActionState } from "./types";

function buildRecoveryPayload(userId: string, formData: FormData) {
  const parsed = recoveryCheckinFormSchema.parse({
    id: formData.get("id"),
    checkinDate: formData.get("checkinDate"),
    sleepHours: formData.get("sleepHours"),
    sleepQuality: formData.get("sleepQuality"),
    readinessLevel: formData.get("readinessLevel"),
    energyLevel: formData.get("energyLevel"),
    stressLevel: formData.get("stressLevel"),
    sorenessLevel: formData.get("sorenessLevel"),
    alcoholCount: formData.get("alcoholCount"),
    restingHeartRate: formData.get("restingHeartRate"),
    hrv: formData.get("hrv"),
    notes: formData.get("notes"),
  });

  return {
    id: parsed.id || undefined,
    userId,
    checkinDate: parsed.checkinDate,
    sleepDurationMinutes:
      parsed.sleepHours != null ? Math.round(parsed.sleepHours * 60) : null,
    sleepQuality: parsed.sleepQuality,
    readinessLevel: parsed.readinessLevel,
    energyLevel: parsed.energyLevel,
    stressLevel: parsed.stressLevel,
    sorenessLevel: parsed.sorenessLevel,
    alcoholCount: parsed.alcoholCount,
    restingHeartRate: parsed.restingHeartRate,
    hrv: parsed.hrv,
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

async function createRecoveryService() {
  const client = await createSupabaseRequestClient();
  return new RecoveryCheckinService(new SupabaseRecoveryCheckinRepository(client));
}

export async function createRecoveryCheckinAction(
  _previousState: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  try {
    const user = await requireCurrentUser();
    const recoveryService = await createRecoveryService();
    await recoveryService.create(buildRecoveryPayload(user.id, formData));
    redirect("/recovery");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function updateRecoveryCheckinAction(
  _previousState: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  try {
    const user = await requireCurrentUser();
    const recoveryService = await createRecoveryService();
    const payload = buildRecoveryPayload(user.id, formData);

    if (!payload.id) {
      return {
        error: "A check-in id is required to update recovery data.",
      };
    }

    await recoveryService.update(payload);
    redirect("/recovery");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function deleteRecoveryCheckinAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/recovery");
  }

  let url = "/recovery";
  try {
    const user = await requireCurrentUser();
    const recoveryService = await createRecoveryService();
    await recoveryService.archive(user.id, id);
  } catch (error) {
    url = `/recovery?error=${encodeURIComponent(
      error instanceof Error ? error.message : "Delete failed.",
    )}`;
  }
  redirect(url);
}
