"use server";

import {
  detectPersonalRecords,
  StrengthSessionService,
  TrainingTemplateService,
} from "@fitness-app/application";
import {
  SupabaseInsightRepository,
  SupabaseStrengthSessionRepository,
  SupabaseTrainingTemplateRepository,
} from "@fitness-app/infrastructure";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { strengthSessionFormSchema, templateExercisesSchema } from "./form-schema";
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
    const client = await createSupabaseRequestClient();
    const service = new StrengthSessionService(new SupabaseStrengthSessionRepository(client));
    const payload = buildStrengthPayload(user.id, formData);
    const session = await service.create(payload);

    const exerciseNames = [...new Set(session.sets.map((s) => s.exerciseName))];
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const startDate = ninetyDaysAgo.toISOString().slice(0, 10);

    const historical = await service.listByDateRange({
      userId: user.id,
      startDate,
      endDate: session.sessionDate,
    });

    const allPrs = exerciseNames.flatMap((exerciseName) => {
      const newSets = session.sets.filter((s) => s.exerciseName === exerciseName);
      const historicalSets = historical
        .filter((s) => s.id !== session.id)
        .flatMap((s) => s.sets.filter((set) => set.exerciseName === exerciseName));
      return detectPersonalRecords(exerciseName, newSets, historicalSets);
    });

    if (allPrs.length > 0) {
      const insightRepo = new SupabaseInsightRepository(client);
      await insightRepo.upsertMany(
        allPrs.map((pr) => ({
          userId: user.id,
          insightType: `personal_record_${pr.prType}_${pr.exerciseName.toLowerCase().replace(/\s+/g, "_")}`,
          title: `New ${pr.prType === "weight" ? "Weight" : "Volume"} PR: ${pr.exerciseName}`,
          body:
            pr.prType === "weight"
              ? `You lifted ${pr.newValue}lb on ${pr.exerciseName}${pr.previousBest != null ? `, beating your previous best of ${pr.previousBest}lb` : ""}.`
              : `You hit a volume of ${pr.newValue}lb on ${pr.exerciseName}${pr.previousBest != null ? `, beating your previous best of ${pr.previousBest}lb` : ""}.`,
          evidence: {
            exerciseName: pr.exerciseName,
            prType: pr.prType,
            newValue: pr.newValue,
            previousBest: pr.previousBest,
            sessionDate: session.sessionDate,
          },
          sourceKind: "rule",
          insightDate: session.sessionDate,
        })),
      );
    }

    redirect("/strength");
  } catch (error) {
    return parseActionError(error);
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
    return parseActionError(error);
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

    let rawExercises: unknown;
    try {
      rawExercises = JSON.parse(
        typeof exercisesPayload === "string" ? exercisesPayload : "[]",
      );
    } catch {
      return { error: "Exercise data could not be read. Please try again." };
    }

    const exercisesResult = templateExercisesSchema.safeParse(rawExercises);
    if (!exercisesResult.success) {
      return { error: "Invalid exercise data. Please check your template." };
    }

    await service.createStrengthTemplate({
      userId: user.id,
      name: name.trim(),
      definition: {
        exercises: exercisesResult.data,
        notes: null,
      },
    });

    redirect("/strength");
  } catch (error) {
    return parseActionError(error);
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
