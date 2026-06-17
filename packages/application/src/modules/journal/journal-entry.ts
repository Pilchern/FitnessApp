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

const TAG_RULES: Array<[RegExp, string]> = [
  [/\b(lift|lifting|weights|strength)\b/, "strength"],
  [/\b(run|running|ran)\b/, "running"],
  [/\b(ride|riding|cycling|bike)\b/, "cycling"],
  [/\b(swim|swimming)\b/, "swimming"],
  [/\b(zone 2|zone2|z2)\b/, "zone2"],
  [/\b(vo2|intervals|hiit)\b/, "vo2"],
  [/\b(sleep|slept|insomnia)\b/, "sleep"],
  [/\b(stress|stressed|anxiety)\b/, "stress"],
  [/\b(alcohol|drinks|drinking|wine|beer)\b/, "alcohol"],
  [/\b(pr|personal record|personal best|pb)\b/, "pr"],
  [/\b(tired|fatigue|exhausted)\b/, "fatigue"],
  [/\b(sick|illness|cold|flu)\b/, "illness"],
  [/\b(travel|traveling|travelling)\b/, "travel"],
  [/\b(nutrition|diet|eating|macros)\b/, "nutrition"],
];

export function inferJournalTags(body: string, existingTags: string[]): string[] {
  const lower = body.toLowerCase();
  const tagSet = new Set(existingTags);
  for (const [pattern, tag] of TAG_RULES) {
    if (!tagSet.has(tag) && pattern.test(lower)) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet);
}

export function computeJournalStreak(
  entries: { entryDate: string }[],
  today: string,
): number {
  if (entries.length === 0) return 0;

  const dates = new Set(entries.map((e) => e.entryDate));
  if (!dates.has(today)) return 0;

  let streak = 1;
  const cursor = new Date(`${today}T12:00:00`);
  for (;;) {
    cursor.setDate(cursor.getDate() - 1);
    const dateStr = cursor.toISOString().slice(0, 10);
    if (!dates.has(dateStr)) break;
    streak++;
  }
  return streak;
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
