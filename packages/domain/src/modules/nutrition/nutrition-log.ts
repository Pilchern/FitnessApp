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
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
