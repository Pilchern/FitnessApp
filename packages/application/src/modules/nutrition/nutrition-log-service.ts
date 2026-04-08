import type { NutritionLogRepository } from "./nutrition-log-repository";
import {
  createNutritionLogSchema,
  nutritionLogDateRangeQuerySchema,
  updateNutritionLogSchema,
} from "./nutrition-log-schemas";

export class NutritionLogService {
  constructor(private readonly repository: NutritionLogRepository) {}

  async create(input: unknown) {
    return this.repository.create(createNutritionLogSchema.parse(input));
  }

  async update(input: unknown) {
    return this.repository.update(updateNutritionLogSchema.parse(input));
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async getById(userId: string, id: string) {
    return this.repository.findById(userId, id);
  }

  async listByDateRange(input: unknown) {
    return this.repository.listByDateRange(
      nutritionLogDateRangeQuerySchema.parse(input),
    );
  }
}
