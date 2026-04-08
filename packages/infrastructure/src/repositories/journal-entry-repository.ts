import type { JournalEntry } from "@fitness-app/domain";
import type {
  CreateJournalEntryInput,
  JournalEntryListQuery,
  JournalEntryRepository,
  UpdateJournalEntryInput,
} from "@fitness-app/application";
import { z } from "zod";
import {
  compactRecord,
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

const journalEntryRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  entry_date: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  tags: z.array(z.string()),
  related_week_start: z.string().nullable(),
  related_weekly_review_id: z.string().uuid().nullable(),
  related_cardio_session_id: z.string().uuid().nullable(),
  related_strength_session_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type JournalEntryRow = z.infer<typeof journalEntryRowSchema>;

export function mapJournalEntryRow(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    userId: row.user_id,
    entryDate: row.entry_date,
    title: row.title,
    body: row.body,
    tags: row.tags,
    relatedWeekStart: row.related_week_start,
    relatedWeeklyReviewId: row.related_weekly_review_id,
    relatedCardioSessionId: row.related_cardio_session_id,
    relatedStrengthSessionId: row.related_strength_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toJournalEntryInsert(input: CreateJournalEntryInput) {
  return {
    user_id: input.userId,
    entry_date: input.entryDate,
    title: input.title ?? null,
    body: input.body,
    tags: input.tags,
    related_week_start: input.relatedWeekStart ?? null,
    related_weekly_review_id: input.relatedWeeklyReviewId ?? null,
    related_cardio_session_id: input.relatedCardioSessionId ?? null,
    related_strength_session_id: input.relatedStrengthSessionId ?? null,
  };
}

function toJournalEntryUpdate(input: UpdateJournalEntryInput) {
  return compactRecord({
    entry_date: input.entryDate,
    title: input.title,
    body: input.body,
    tags: input.tags,
    related_week_start: input.relatedWeekStart,
    related_weekly_review_id: input.relatedWeeklyReviewId,
    related_cardio_session_id: input.relatedCardioSessionId,
    related_strength_session_id: input.relatedStrengthSessionId,
  });
}

export class SupabaseJournalEntryRepository implements JournalEntryRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async create(input: CreateJournalEntryInput) {
    const response = await this.client
      .from("journal_entries")
      .insert(toJournalEntryInsert(input))
      .select("*")
      .single();

    return mapJournalEntryRow(
      journalEntryRowSchema.parse(
        requireSingleResult(response, "Create journal entry"),
      ),
    );
  }

  async update(input: UpdateJournalEntryInput) {
    const response = await this.client
      .from("journal_entries")
      .update(toJournalEntryUpdate(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    return mapJournalEntryRow(
      journalEntryRowSchema.parse(
        requireSingleResult(response, "Update journal entry"),
      ),
    );
  }

  async findById(userId: string, id: string) {
    const response = await this.client
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    throwOnError(response.error, "Fetch journal entry");

    return response.data
      ? mapJournalEntryRow(journalEntryRowSchema.parse(response.data))
      : null;
  }

  async archive(userId: string, id: string) {
    const response = await this.client
      .from("journal_entries")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive journal entry");
  }

  async listByDateRange(query: JournalEntryListQuery) {
    let request = this.client
      .from("journal_entries")
      .select("*")
      .eq("user_id", query.userId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(500);

    if (query.startDate) {
      request = request.gte("entry_date", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("entry_date", query.endDate);
    }

    if (query.tag) {
      request = request.contains("tags", [query.tag]);
    }

    if (query.searchTerm) {
      request = request.or(
        `title.ilike.%${query.searchTerm}%,body.ilike.%${query.searchTerm}%`,
      );
    }

    const response = await request;
    throwOnError(response.error, "List journal entries");

    return journalEntryRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapJournalEntryRow);
  }
}
