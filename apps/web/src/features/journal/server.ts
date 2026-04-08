import "server-only";

import { CardioSessionService, JournalEntryService, WeeklyReviewService } from "@fitness-app/application";
import {
  SupabaseCardioSessionRepository,
  SupabaseJournalEntryRepository,
  SupabaseWeeklyReviewRepository,
} from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import type { JournalPageData } from "./types";

async function createDependencies() {
  const client = await createSupabaseRequestClient();

  return {
    journalService: new JournalEntryService(new SupabaseJournalEntryRepository(client)),
    cardioService: new CardioSessionService(new SupabaseCardioSessionRepository(client)),
    weeklyReviewService: new WeeklyReviewService(new SupabaseWeeklyReviewRepository(client)),
  };
}

export async function getJournalPageData({
  editEntryId,
  searchTerm,
  tag,
  startDate,
  endDate,
}: {
  editEntryId?: string;
  searchTerm?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
}): Promise<JournalPageData> {
  const user = await requireCurrentUser();
  const { journalService, cardioService } = await createDependencies();

  const [entries, cardioSessions, editingEntry] = await Promise.all([
    journalService.listEntries({
      userId: user.id,
      searchTerm: searchTerm || undefined,
      tag: tag || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    cardioService.listByDateRange({
      userId: user.id,
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    }),
    editEntryId ? journalService.getById(user.id, editEntryId) : Promise.resolve(null),
  ]);

  return {
    entries,
    cardioSessions,
    editingEntry,
    filters: {
      searchTerm: searchTerm ?? "",
      tag: tag ?? "",
      startDate: startDate ?? "",
      endDate: endDate ?? "",
    },
    formError:
      editEntryId && !editingEntry
        ? "The journal entry you tried to edit could not be found."
        : undefined,
  };
}
