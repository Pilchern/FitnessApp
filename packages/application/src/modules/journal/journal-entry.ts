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

export function inferJournalTags(
  body: string,
  existingTags: string[],
): string[] {
  const lower = body.toLowerCase();
  const tagSet = new Set(existingTags);
  for (const [pattern, tag] of TAG_RULES) {
    if (!tagSet.has(tag) && pattern.test(lower)) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet);
}

/**
 * Shift an ISO date (YYYY-MM-DD) by whole days without ever leaving UTC.
 *
 * Anchoring at 12:00 UTC and mutating/reading only UTC fields keeps the result
 * independent of the host timezone. Parsing `${iso}T12:00:00` (no `Z`) would be
 * interpreted as *local* time while `toISOString()` reads back UTC, which skips
 * or repeats a day at large offsets.
 *
 * Mirrors the `shiftIsoDate` helper in ../cardio/cardio-session.ts; if a third
 * caller appears this belongs in ../../shared as a single exported helper.
 */
function shiftIsoDate(isoDate: string, days: number): string {
  const anchored = new Date(`${isoDate}T12:00:00.000Z`);
  anchored.setUTCDate(anchored.getUTCDate() + days);
  return anchored.toISOString().slice(0, 10);
}

export function computeJournalStreak(
  entries: { entryDate: string }[],
  today: string,
): number {
  if (entries.length === 0) return 0;

  const dates = new Set(entries.map((e) => e.entryDate));
  if (!dates.has(today)) return 0;

  let streak = 1;
  let cursor = today;
  for (;;) {
    cursor = shiftIsoDate(cursor, -1);
    if (!dates.has(cursor)) break;
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
    return this.repository.listByDateRange(
      journalEntryListQuerySchema.parse(input),
    );
  }
}
