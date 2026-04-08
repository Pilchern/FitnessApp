import type { EntityId, NutritionLog, UserId } from "@fitness-app/domain";
import type {
  CreateNutritionLogInput,
  NutritionLogDateRangeQuery,
  UpdateNutritionLogInput,
} from "./nutrition-log-schemas";

export interface NutritionLogRepository {
  create(input: CreateNutritionLogInput): Promise<NutritionLog>;
  update(input: UpdateNutritionLogInput): Promise<NutritionLog>;
  archive(userId: UserId, id: EntityId): Promise<void>;
  findById(userId: UserId, id: EntityId): Promise<NutritionLog | null>;
  listByDateRange(query: NutritionLogDateRangeQuery): Promise<NutritionLog[]>;
}
