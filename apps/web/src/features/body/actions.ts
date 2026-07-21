"use server";

import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import { bodyMetricFormSchema } from "./form-schema";
import type { BodyActionState } from "./types";

function buildBodyMetricPayload(userId: string, formData: FormData) {
  const parsed = bodyMetricFormSchema.parse({
    id: formData.get("id"),
    measuredOn: formData.get("measuredOn"),
    weightLb: formData.get("weightLb"),
    waistIn: formData.get("waistIn"),
    waistHipIn: formData.get("waistHipIn"),
    waistGutIn: formData.get("waistGutIn"),
    bodyFatPct: formData.get("bodyFatPct"),
    muscleMassLb: formData.get("muscleMassLb"),
    sourceType: formData.get("sourceType"),
    notes: formData.get("notes"),
  });

  return {
    id: parsed.id || undefined,
    userId,
    measuredOn: parsed.measuredOn,
    weightLb: parsed.weightLb,
    waistIn: parsed.waistIn,
    waistHipIn: parsed.waistHipIn,
    waistGutIn: parsed.waistGutIn,
    bodyFatPct: parsed.bodyFatPct,
    muscleMassLb: parsed.muscleMassLb,
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

export async function createBodyMetricAction(
  _previousState: BodyActionState,
  formData: FormData,
): Promise<BodyActionState> {
  try {
    const user = await requireCurrentUser();
    const { bodyMetricService } = await createCoreServices();
    await bodyMetricService.create(buildBodyMetricPayload(user.id, formData));
    redirect("/body");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function updateBodyMetricAction(
  _previousState: BodyActionState,
  formData: FormData,
): Promise<BodyActionState> {
  try {
    const user = await requireCurrentUser();
    const { bodyMetricService } = await createCoreServices();
    const payload = buildBodyMetricPayload(user.id, formData);

    if (!payload.id) {
      return {
        error: "A body metric id is required to update an entry.",
      };
    }

    await bodyMetricService.update(payload);
    redirect("/body");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function deleteBodyMetricAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/body");
  }

  let url = "/body?deleted=1";
  try {
    const user = await requireCurrentUser();
    const { bodyMetricService } = await createCoreServices();
    await bodyMetricService.archive(user.id, id);
  } catch (error) {
    url = `/body?error=${encodeURIComponent(error instanceof Error ? error.message : "Delete failed.")}`;
  }
  redirect(url);
}
