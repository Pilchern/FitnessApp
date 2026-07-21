"use server";

import { calculateWeeklyReviewScore } from "@fitness-app/application";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import { weeklyReviewFormSchema } from "./form-schema";
import type { WeeklyReviewActionState } from "./types";

function buildWeeklyReviewPayload(userId: string, formData: FormData) {
  const parsed = weeklyReviewFormSchema.parse({
    id: formData.get("id"),
    weekStart: formData.get("weekStart"),
    weekEnd: formData.get("weekEnd"),
    averageWeightLb: formData.get("averageWeightLb"),
    waistIn: formData.get("waistIn"),
    liftsCompleted: formData.get("liftsCompleted"),
    ridesCompleted: formData.get("ridesCompleted"),
    zone2Minutes: formData.get("zone2Minutes"),
    vo2Completed: formData.get("vo2Completed"),
    sleepAverageHours: formData.get("sleepAverageHours"),
    alcoholTotal: formData.get("alcoholTotal"),
    bestWin: formData.get("bestWin"),
    biggestMiss: formData.get("biggestMiss"),
    lesson: formData.get("lesson"),
    nextWeekPriority: formData.get("nextWeekPriority"),
    strategicDecision: formData.get("strategicDecision"),
    riskForecast: formData.get("riskForecast"),
    confidence: formData.get("confidence"),
    manualOverrides: formData.get("manualOverrides"),
  });

  const summary = {
    averageWeightLb: parsed.averageWeightLb,
    waistIn: parsed.waistIn,
    liftsCompleted: parsed.liftsCompleted,
    ridesCompleted: parsed.ridesCompleted,
    zone2Minutes: parsed.zone2Minutes,
    vo2Completed: parsed.vo2Completed === "true",
    sleepAverageHours: parsed.sleepAverageHours,
    alcoholTotal: parsed.alcoholTotal,
  };

  const scoring = calculateWeeklyReviewScore({
    summary,
    confidence: parsed.confidence,
  });

  return {
    id: parsed.id || undefined,
    userId,
    weekStart: parsed.weekStart,
    weekEnd: parsed.weekEnd,
    status: "completed" as const,
    summary,
    bestWin: parsed.bestWin || null,
    biggestMiss: parsed.biggestMiss || null,
    lesson: parsed.lesson || null,
    nextWeekPriority: parsed.nextWeekPriority || null,
    confidence: parsed.confidence,
    scoreDetails: scoring.scoreDetails,
    // strategicDecision/riskForecast default to the rule-based computed
    // recommendation (unchanged behavior), but the user can override them —
    // including via the AI draft's "Use this draft" pre-fill, which only
    // lands here once the user submits this same save action.
    strategicDecision: parsed.strategicDecision || scoring.strategicDecision,
    riskForecast: parsed.riskForecast || scoring.riskForecast,
    manualOverrides: parsed.manualOverrides,
    completedAt: new Date().toISOString(),
  };
}

export async function saveWeeklyReviewAction(
  _previousState: WeeklyReviewActionState,
  formData: FormData,
): Promise<WeeklyReviewActionState> {
  try {
    const user = await requireCurrentUser();
    const { weeklyReviewService: service } = await createCoreServices();
    const payload = buildWeeklyReviewPayload(user.id, formData);

    if (payload.id) {
      await service.update(payload);
    } else {
      await service.create(payload);
    }

    redirect(`/weekly-review?weekStart=${payload.weekStart}`);
  } catch (error) {
    return parseActionError(error);
  }
}

function requiredFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

/**
 * Marks the AI weekly review draft as accepted. Does NOT write the draft's
 * content into bestWin/biggestMiss/strategicDecision/riskForecast — those
 * are only pre-filled into the manual edit form (see
 * toWeeklyReviewFormValues in ../helpers.ts) and require the user's normal
 * saveWeeklyReviewAction submit to actually persist.
 */
export async function useAiWeeklyReviewDraftAction(
  _previousState: WeeklyReviewActionState,
  formData: FormData,
): Promise<WeeklyReviewActionState> {
  try {
    const user = await requireCurrentUser();
    const { weeklyReviewService: service } = await createCoreServices();
    const id = requiredFormString(formData, "id");
    const weekStart = requiredFormString(formData, "weekStart");

    await service.acceptAiDraft(user.id, id);

    redirect(`/weekly-review?weekStart=${weekStart}`);
  } catch (error) {
    return parseActionError(error);
  }
}

/**
 * Discards the AI weekly review draft. The manual flow proceeds exactly as
 * it does today, with nothing pre-filled.
 */
export async function dismissAiWeeklyReviewDraftAction(
  _previousState: WeeklyReviewActionState,
  formData: FormData,
): Promise<WeeklyReviewActionState> {
  try {
    const user = await requireCurrentUser();
    const { weeklyReviewService: service } = await createCoreServices();
    const id = requiredFormString(formData, "id");
    const weekStart = requiredFormString(formData, "weekStart");

    await service.dismissAiDraft(user.id, id);

    redirect(`/weekly-review?weekStart=${weekStart}`);
  } catch (error) {
    return parseActionError(error);
  }
}
