"use server";

import {
  calculateWeeklyReviewScore,
  WeeklyReviewService,
} from "@fitness-app/application";
import { SupabaseWeeklyReviewRepository } from "@fitness-app/infrastructure";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { getErrorMessage } from "@/lib/server/get-error-message";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { weeklyReviewFormSchema } from "./form-schema";
import type { WeeklyReviewActionState } from "./types";

async function createWeeklyReviewService() {
  const client = await createSupabaseRequestClient();
  return new WeeklyReviewService(new SupabaseWeeklyReviewRepository(client));
}

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
    strategicDecision: scoring.strategicDecision,
    riskForecast: scoring.riskForecast,
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
    const service = await createWeeklyReviewService();
    const payload = buildWeeklyReviewPayload(user.id, formData);

    if (payload.id) {
      await service.update(payload);
    } else {
      await service.create(payload);
    }

    redirect(`/weekly-review?weekStart=${payload.weekStart}`);
  } catch (error) {
    return {
      error: getErrorMessage(error),
    };
  }
}
