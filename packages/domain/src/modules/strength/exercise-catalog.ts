export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core";

export type MovementPattern = "push" | "pull" | "legs" | "core";

export type ExerciseCategory = "compound" | "isolation";

export type ExerciseCatalogEntry = {
  canonicalName: string;
  muscleGroup: MuscleGroup;
  movementPattern: MovementPattern;
  category: ExerciseCategory;
  /** Alternate spellings/shorthand that resolve to this same canonical entry. */
  aliases: string[];
};

/**
 * A user-taught classification for an exercise name the built-in catalog
 * doesn't recognize (TD-021). Checked before the built-in catalog at read
 * time, so it always wins for names the user has explicitly classified.
 */
export type ExerciseMuscleGroupOverride = {
  id: string;
  userId: string;
  exerciseName: string;
  normalizedName: string;
  muscleGroup: MuscleGroup;
  movementPattern: MovementPattern;
  category: ExerciseCategory;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
