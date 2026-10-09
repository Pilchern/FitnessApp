import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";

export type SupplementKind = "supplement" | "habit";

export type Supplement = {
  id: EntityId;
  userId: UserId;
  name: string;
  /** "habit" rows are daily habits (e.g. Foundation Training), not pills. */
  kind: SupplementKind;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};

export type SupplementLog = {
  id: EntityId;
  userId: UserId;
  supplementId: EntityId;
  logDate: IsoDate;
  taken: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
