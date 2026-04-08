import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";

export type JournalEntry = {
  id: EntityId;
  userId: UserId;
  entryDate: IsoDate;
  title: string | null;
  body: string;
  tags: string[];
  relatedWeekStart: IsoDate | null;
  relatedWeeklyReviewId: EntityId | null;
  relatedCardioSessionId: EntityId | null;
  relatedStrengthSessionId: EntityId | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
