"use server";

import { StrengthSessionService, TrainingTemplateService } from "@fitness-app/application";
import {
  SupabaseStrengthSessionRepository,
  SupabaseTrainingTemplateRepository,
} from "@fitness-app/infrastructure";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { getErrorMessage } from "@/lib/server/get-error-message";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { strengthSessionFormSchema } from "./form-schema";
import type { StrengthActionState } from "./types";

async function createStrengthService() {
  const client = await createSupabaseRequestClient();
  return new StrengthSessionService(new SupabaseStrengthSessionRepository(client));
}

async function createTemplateService() {
  const client = await createSupabaseRequestClient();
  return new TrainingTemplateService(new SupabaseTrainingTemplateRepository(client));
}

function buildStrengthPayload(userId: string, formData: FormData) {
  const parsed = strengthSessionFormSchema.parse({
    id: formData.get("id"),
    sessionDate: formData.get("sessionDate"),
    sessionName: formData.get("sessionName"),
    notes: formData.get("notes"),
    durationMinutes: formData.get("durationMinutes"),
    readinessPre: formData.get("readinessPre"),
    energyPost: formData.get("energyPost"),
    completedAsPlanned: formData.get("completedAsPlanned"),
    setsPayload: formData.get("setsPayload"),
  });

  return {
    id: parsed.id || undefined,
    userId,
    sessionDate: parsed.sessionDate,
    sessionName: parsed.sessionName || null,
    notes: parsed.notes || null,
    durationMinutes: parsed.durationMinutes,
    readinessPre: parsed.readinessPre,
    energyPost: parsed.energyPost,
    completedAsPlanned: parsed.completedAsPlanned,
    source: {
      sourceType: "manual" as const,
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    },
    sets: parsed.setsPayload.map((set, index) => ({
      exerciseName: set.exerciseName,
      exerciseOrder: index,
      setNumber: set.setNumber,
      reps: set.reps,
      weight: set.weight,
      rir: set.rir,
      notes: set.notes || null,
    })),
  };
}

export async function createStrengthSessionAction(
  _previousState: StrengthActionState,
  formData: FormData,
): Promise<StrengthActionState> {
  try {
    const user = await requireCurrentUser();
    const service = await createStrengthService();
    await service.create(buildStrengthPayload(user.id, formData));
    redirect("/strength");
  } catch (error) {
    return {
      error: getErrorMessage(error),
    };
  }
}

export async function updateStrengthSessionAction(
  _previousState: StrengthActionState,
  formData: FormData,
): Promise<StrengthActionState> {
  try {
    const user = await requireCurrentUser();
    const service = await createStrengthService();
    const payload = buildStrengthPayload(user.id, formData);

    if (!payload.id) {
      return {
        error: "A strength session id is required to update a session.",
      };
    }

    await service.update(payload);
    redirect(`/strength/${payload.id}`);
  } catch (error) {
    return {
      error: getErrorMessage(error),
    };
  }
}

export async function deleteStrengthSessionAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/strength");
  }

  let url = "/strength";
  try {
    const user = await requireCurrentUser();
    const service = await createStrengthService();
    await service.archive(user.id, id);
  } catch (error) {
    url = `/strength?error=${encodeURIComponent(error instanceof Error ? error.message : "Delete failed.")}`;
  }
  redirect(url);
}

export async function createStrengthTemplateAction(
  _prevState: StrengthActionState,
  formData: FormData,
): Promise<StrengthActionState> {
  try {
    const user = await requireCurrentUser();
    const service = await createTemplateService();

    const name = formData.get("name");
    const exercisesPayload = formData.get("exercisesPayload");

    if (typeof name !== "string" || !name.trim()) {
      return { error: "Template name is required." };
    }

    let parsedExercises: unknown;
    try {
      parsedExercises = JSON.parse(
        typeof exercisesPayload === "string" ? exercisesPayload : "[]",
      );
    } catch {
      return { error: "Exercise data could not be read. Please try again." };
    }

    await service.createStrengthTemplate({
      userId: user.id,
      name: name.trim(),
      definition: {
        exercises: parsedExercises,
        notes: null,
      },
    });

    redirect("/strength");
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function archiveStrengthTemplateAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/strength");
  }

  let url = "/strength";
  try {
    const user = await requireCurrentUser();
    const service = await createTemplateService();
    await service.archiveTemplate(user.id, id);
  } catch (error) {
    url = `/strength?error=${encodeURIComponent(error instanceof Error ? error.message : "Archive failed.")}`;
  }
  redirect(url);
}
