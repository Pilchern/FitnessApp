import type { ExerciseMuscleGroupOverride } from "@fitness-app/domain";
import type {
  ClassifyExerciseInput,
  ExerciseOverrideRepository,
} from "@fitness-app/application";
import { z } from "zod";
import {
  type AppSupabaseClient,
  requireSingleResult,
  throwOnError,
} from "./shared";

const exerciseOverrideRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  exercise_name: z.string(),
  normalized_name: z.string(),
  muscle_group: z.enum([
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
  ]),
  movement_pattern: z.enum(["push", "pull", "legs", "core"]),
  category: z.enum(["compound", "isolation"]),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type ExerciseOverrideRow = z.infer<typeof exerciseOverrideRowSchema>;

function mapExerciseOverrideRow(
  row: ExerciseOverrideRow,
): ExerciseMuscleGroupOverride {
  return {
    id: row.id,
    userId: row.user_id,
    exerciseName: row.exercise_name,
    normalizedName: row.normalized_name,
    muscleGroup: row.muscle_group,
    movementPattern: row.movement_pattern,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SupabaseExerciseOverrideRepository implements ExerciseOverrideRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async upsert(input: ClassifyExerciseInput) {
    const response = await this.client
      .from("exercise_muscle_group_overrides")
      .upsert(
        {
          user_id: input.userId,
          exercise_name: input.exerciseName,
          normalized_name: input.normalizedName,
          muscle_group: input.muscleGroup,
          movement_pattern: input.movementPattern,
          category: input.category,
          deleted_at: null,
        },
        { onConflict: "user_id,normalized_name" },
      )
      .select("*")
      .single();

    return mapExerciseOverrideRow(
      exerciseOverrideRowSchema.parse(
        requireSingleResult(response, "Classify exercise"),
      ),
    );
  }

  async archive(userId: string, id: string) {
    const response = await this.client
      .from("exercise_muscle_group_overrides")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    throwOnError(response.error, "Archive exercise override");
  }

  async listActive(userId: string) {
    const response = await this.client
      .from("exercise_muscle_group_overrides")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("exercise_name", { ascending: true });

    throwOnError(response.error, "List exercise overrides");

    return exerciseOverrideRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapExerciseOverrideRow);
  }
}
