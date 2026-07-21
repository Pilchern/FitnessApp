"use server";

import { inferJournalTags } from "@fitness-app/application";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import { journalEntryFormSchema } from "./form-schema";
import type { JournalActionState } from "./types";

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

  const { weeklyReviewService } = await createCoreServices();
  const relatedReview = parsed.relatedWeekStart
    ? await weeklyReviewService.getByWeekStart({
        userId,
        weekStart: parsed.relatedWeekStart,
      })
    : null;

  const tags = inferJournalTags(parsed.body, parsed.tags);

  return {
    id: parsed.id || undefined,
    userId,
    entryDate: parsed.entryDate,
    title: parsed.title || null,
    body: parsed.body,
    tags,
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
    const { journalService } = await createCoreServices();
    const payload = await buildJournalPayload(user.id, formData);
    await journalService.create(payload);
    redirect("/journal");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function updateJournalEntryAction(
  _previousState: JournalActionState,
  formData: FormData,
): Promise<JournalActionState> {
  try {
    const user = await requireCurrentUser();
    const { journalService } = await createCoreServices();
    const payload = await buildJournalPayload(user.id, formData);

    if (!payload.id) {
      return {
        error: "A journal entry id is required to update an entry.",
      };
    }

    await journalService.update(payload);
    redirect("/journal");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function deleteJournalEntryAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/journal");
  }

  let url = "/journal";
  try {
    const user = await requireCurrentUser();
    const { journalService } = await createCoreServices();
    await journalService.archive(user.id, id);
  } catch (error) {
    url = `/journal?error=${encodeURIComponent(
      error instanceof Error ? error.message : "Delete failed.",
    )}`;
  }
  redirect(url);
}
