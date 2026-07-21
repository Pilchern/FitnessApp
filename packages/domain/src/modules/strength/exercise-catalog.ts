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
