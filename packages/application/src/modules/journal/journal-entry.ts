import type { EntityId, JournalEntry, UserId } from "@fitness-app/domain";
import { z } from "zod";
import {
  dateRangeQuerySchema,
  ensureAtLeastOneDefined,
  isoDateSchema,
  optionalTrimmedStringSchema,
  trimmedStringSchema,
  uuidSchema,
} from "../../shared/primitives";

const journalEntryBaseSchema = z.object({
  entryDate: isoDateSchema,
  title: optionalTrimmedStringSchema,
  body: trimmedStringSchema,
  tags: z.array(trimmedStringSchema).default([]),
  relatedWeekStart: isoDateSchema.nullable().optional(),
  relatedWeeklyReviewId: uuidSchema.nullable().optional(),
  relatedCardioSessionId: uuidSchema.nullable().optional(),
  relatedStrengthSessionId: uuidSchema.nullable().optional(),
});

export const createJournalEntrySchema = journalEntryBaseSchema.extend({
  userId: uuidSchema,
});

export const updateJournalEntrySchema = journalEntryBaseSchema
  .partial()
  .extend({
    id: uuidSchema,
    userId: uuidSchema,
  })
  .refine(
    (value) =>
      ensureAtLeastOneDefined(value, [
        "entryDate",
        "title",
        "body",
        "tags",
        "relatedWeekStart",
        "relatedWeeklyReviewId",
        "relatedCardioSessionId",
        "relatedStrengthSessionId",
      ]),
    {
      message: "At least one field must be provided for update",
    },
  );

export const journalEntryDateRangeQuerySchema = dateRangeQuerySchema;
export const journalEntryListQuerySchema = journalEntryDateRangeQuerySchema.and(
  z.object({
    tag: trimmedStringSchema.optional(),
    searchTerm: trimmedStringSchema.optional(),
  }),
);

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type JournalEntryDateRangeQuery = z.infer<
  typeof journalEntryDateRangeQuerySchema
>;
export type JournalEntryListQuery = z.infer<typeof journalEntryListQuerySchema>;

export type JournalEntryListItemDto = {
  id: EntityId;
  entryDate: string;
  title: string | null;
  tags: string[];
};

export interface JournalEntryRepository {
  create(input: CreateJournalEntryInput): Promise<JournalEntry>;
  update(input: UpdateJournalEntryInput): Promise<JournalEntry>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<JournalEntry | null>;
  listByDateRange(query: JournalEntryListQuery): Promise<JournalEntry[]>;
}

export class JournalEntryService {
  constructor(private readonly repository: JournalEntryRepository) {}

  async create(input: unknown) {
    return this.repository.create(createJournalEntrySchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateJournalEntrySchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async listByDateRange(input: unknown): Promise<JournalEntryListItemDto[]> {
    const entries = await this.repository.listByDateRange(
      journalEntryListQuerySchema.parse(input),
    );

    return entries.map((entry) => ({
      id: entry.id,
      entryDate: entry.entryDate,
      title: entry.title,
      tags: entry.tags,
    }));
  }

  async listEntries(input: unknown) {
    return this.repository.listByDateRange(journalEntryListQuerySchema.parse(input));
  }
}
