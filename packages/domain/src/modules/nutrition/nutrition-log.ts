import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";

export type NutritionLog = {
  id: EntityId;
  userId: UserId;
  logDate: IsoDate;
  proteinHit: boolean | null;
  mealsOnPlan: boolean | null;
  noPostDinnerSnacking: boolean | null;
  junkLeakage: boolean | null;
  fiberTaken: boolean | null;
  alcoholCount: number;
  /** Fast daily entry (absent on rows before 2026-10-19). */
  proteinGrams?: number | null;
  calories?: number | null;
  creatineTaken?: boolean | null;
  protein50By9am?: boolean | null;
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
