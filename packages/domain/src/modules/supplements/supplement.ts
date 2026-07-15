import type { EntityId, IsoDate, IsoDateTime, UserId } from "../../shared/ids";

export type Supplement = {
  id: EntityId;
  userId: UserId;
  name: string;
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
