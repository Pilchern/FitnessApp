import type { EntityId, Supplement, UserId } from "@fitness-app/domain";
import {
  createSupplementSchema,
  listSupplementsQuerySchema,
  updateSupplementSchema,
  type CreateSupplementInput,
  type UpdateSupplementInput,
} from "./supplement-schemas";

export interface SupplementRepository {
  create(input: CreateSupplementInput): Promise<Supplement>;
  update(input: UpdateSupplementInput): Promise<Supplement>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<Supplement | null>;
  listAll(userId: UserId): Promise<Supplement[]>;
  listActive(userId: UserId): Promise<Supplement[]>;
}

export class SupplementService {
  constructor(private readonly repository: SupplementRepository) {}

  async create(input: unknown) {
    return this.repository.create(createSupplementSchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateSupplementSchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async listAll(input: unknown) {
    const query = listSupplementsQuerySchema.parse(input);
    return this.repository.listAll(query.userId);
  }

  async listActive(input: unknown) {
    const query = listSupplementsQuerySchema.parse(input);
    return this.repository.listActive(query.userId);
  }
}
