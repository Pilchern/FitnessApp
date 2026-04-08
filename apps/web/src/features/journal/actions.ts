"use server";

import { JournalEntryService, WeeklyReviewService } from "@fitness-app/application";
import {
  SupabaseJournalEntryRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { getErrorMessage } from "@/lib/server/get-error-message";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { journalEntryFormSchema } from "./form-schema";
import type { JournalActionState } from "./types";

async function createDependencies() {
  const client = await createSupabaseRequestClient();
  return {
    journalService: new JournalEntryService(new SupabaseJournalEntryRepository(client)),
    weeklyReviewService: new WeeklyReviewService(new SupabaseWeeklyReviewRepository(client)),
  };
}

async function buildJournalPayload(userId: string, formData: FormData) {
  const parsed = journalEntryFormSchema.parse({
    id: formData.get("id"),
    entryDate: formData.get("entryDate"),
    title: formData.get("title"),
    body: formData.get("body"),
    tags: formData.get("tags"),
    relatedWeekStart: formData.get("relatedWeekStart"),
    relatedCardioSessionId: formData.get("relatedCardioSessionId"),
    relatedStrengthSessionId: formData.get("relatedStrengthSessionId"),
  });

  const { weeklyReviewService } = await createDependencies();
  const relatedReview = parsed.relatedWeekStart
    ? await weeklyReviewService.getByWeekStart({
        userId,
        weekStart: parsed.relatedWeekStart,
      })
    : null;

  return {
    id: parsed.id || undefined,
    userId,
    entryDate: parsed.entryDate,
    title: parsed.title || null,
    body: parsed.body,
    tags: parsed.tags,
    relatedWeekStart: parsed.relatedWeekStart,
    relatedWeeklyReviewId: relatedReview?.id ?? null,
    relatedCardioSessionId: parsed.relatedCardioSessionId,
    relatedStrengthSessionId: parsed.relatedStrengthSessionId,
  };
}

export async function createJournalEntryAction(
  _previousState: JournalActionState,
  formData: FormData,
): Promise<JournalActionState> {
  try {
    const user = await requireCurrentUser();
    const { journalService } = await createDependencies();
    const payload = await buildJournalPayload(user.id, formData);
    await journalService.create(payload);
    redirect("/journal");
  } catch (error) {
    return {
      error: getErrorMessage(error),
    };
  }
}

export async function updateJournalEntryAction(
  _previousState: JournalActionState,
  formData: FormData,
): Promise<JournalActionState> {
  try {
    const user = await requireCurrentUser();
    const { journalService } = await createDependencies();
    const payload = await buildJournalPayload(user.id, formData);

    if (!payload.id) {
      return {
        error: "A journal entry id is required to update an entry.",
      };
    }

    await journalService.update(payload);
    redirect("/journal");
  } catch (error) {
    return {
      error: getErrorMessage(error),
    };
  }
}

export async function deleteJournalEntryAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/journal");
  }

  try {
    const user = await requireCurrentUser();
    const { journalService } = await createDependencies();
    await journalService.archive(user.id, id);
  } catch (error) {
    console.error("deleteJournalEntryAction: archive failed", error);
  }

  redirect("/journal");
}
