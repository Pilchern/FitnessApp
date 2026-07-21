"use server";

import { detectPersonalRecords } from "@fitness-app/application";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import { strengthSessionFormSchema, templateExercisesSchema } from "./form-schema";
import type { StrengthActionState } from "./types";

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
      isWarmup: set.isWarmup,
      durationSeconds: set.durationSeconds,
      distanceMeters: set.distanceMeters,
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
    const { strengthService: service, insightRepository } = await createCoreServices();
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
      const newSets = session.sets.filter(
        (s) => s.exerciseName === exerciseName && !s.isWarmup,
      );
      const historicalSets = historical
        .filter((s) => s.id !== session.id)
        .flatMap((s) => s.sets.filter((set) => set.exerciseName === exerciseName && !set.isWarmup));
      return detectPersonalRecords(exerciseName, newSets, historicalSets);
    });

    if (allPrs.length > 0) {
      await insightRepository.upsertMany(
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
    const { strengthService: service } = await createCoreServices();
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
    const { strengthService: service } = await createCoreServices();
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
    const { trainingTemplateService: service } = await createCoreServices();

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
    const { trainingTemplateService: service } = await createCoreServices();
    await service.archiveTemplate(user.id, id);
  } catch (error) {
    url = `/strength?error=${encodeURIComponent(error instanceof Error ? error.message : "Archive failed.")}`;
  }
  redirect(url);
}
