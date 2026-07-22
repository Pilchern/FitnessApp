import type { ExerciseMuscleGroupOverride, UserId } from "@fitness-app/domain";
import { z } from "zod";
import { trimmedStringSchema, uuidSchema } from "../../shared/primitives";
import { normalizeExerciseName } from "./exercise-catalog-data";

const muscleGroupSchema = z.enum([
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
]);

const movementPatternSchema = z.enum(["push", "pull", "legs", "core"]);
const categorySchema = z.enum(["compound", "isolation"]);

export const classifyExerciseSchema = z.object({
  userId: uuidSchema,
  exerciseName: trimmedStringSchema.max(100),
  muscleGroup: muscleGroupSchema,
  movementPattern: movementPatternSchema,
  category: categorySchema,
});

export const listExerciseOverridesQuerySchema = z.object({
  userId: uuidSchema,
});

export type ClassifyExerciseInput = z.infer<typeof classifyExerciseSchema> & {
  normalizedName: string;
};

export interface ExerciseOverrideRepository {
  upsert(input: ClassifyExerciseInput): Promise<ExerciseMuscleGroupOverride>;
  archive(userId: UserId, id: string): Promise<void>;
  listActive(userId: UserId): Promise<ExerciseMuscleGroupOverride[]>;
}

/**
 * Lets a user teach the app a muscle-group/movement-pattern/category
 * classification for an exercise name the built-in catalog
 * (exercise-catalog-data.ts) doesn't recognize (TD-021). `classify()`
 * upserts by (userId, normalizedName) rather than strictly creating, so
 * re-classifying an exercise (or re-adding one that was archived) is the
 * same single action as classifying it the first time — no separate
 * create/update flow needed in the UI.
 */
export class ExerciseOverrideService {
  constructor(private readonly repository: ExerciseOverrideRepository) {}

  async classify(input: unknown) {
    const parsed = classifyExerciseSchema.parse(input);
    return this.repository.upsert({
      ...parsed,
      normalizedName: normalizeExerciseName(parsed.exerciseName),
    });
  }

  async archive(userId: string, id: string) {
    return this.repository.archive(userId, id);
  }

  async listActive(input: unknown) {
    const query = listExerciseOverridesQuerySchema.parse(input);
    return this.repository.listActive(query.userId);
  }
}
