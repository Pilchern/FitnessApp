import type { ExerciseCatalogEntry, ExerciseMuscleGroupOverride } from "@fitness-app/domain";

/**
 * Curated catalog scoped to the equipment this app is built around (squat
 * rack, barbell, adjustable dumbbells, flat/incline bench, pull-up bar,
 * bodyweight). Entries carry aliases so common shorthand ("DB Bench", "BB
 * Row", "OHP") resolves to the same canonical exercise instead of
 * fragmenting history. Exercises outside this list can be classified
 * per-user at runtime via exercise_muscle_group_overrides (see
 * exercise-override.ts and resolveExercise()'s `overrides` parameter) rather
 * than requiring a code change (TD-021).
 * Conventional barbell deadlift is intentionally still classified (kept for
 * historical/imported data) even though it's not part of the recommended
 * plan given the user's lower-back constraint.
 */
export const EXERCISE_CATALOG: ExerciseCatalogEntry[] = [
  // Chest (push)
  {
    canonicalName: "Barbell Bench Press",
    muscleGroup: "chest",
    movementPattern: "push",
    category: "compound",
    aliases: [
      "bench press",
      "barbell bench",
      "flat bench press",
      "bb bench",
      "flat bench",
    ],
  },
  {
    canonicalName: "Incline Barbell Bench Press",
    muscleGroup: "chest",
    movementPattern: "push",
    category: "compound",
    aliases: [
      "incline bench press",
      "incline barbell bench",
      "incline bb bench",
    ],
  },
  {
    canonicalName: "Dumbbell Bench Press",
    muscleGroup: "chest",
    movementPattern: "push",
    category: "compound",
    aliases: ["db bench", "db bench press", "dumbbell bench", "flat db press"],
  },
  {
    canonicalName: "Incline Dumbbell Press",
    muscleGroup: "chest",
    movementPattern: "push",
    category: "compound",
    aliases: ["incline db press", "incline dumbbell bench"],
  },
  {
    canonicalName: "Dumbbell Flye",
    muscleGroup: "chest",
    movementPattern: "push",
    category: "isolation",
    aliases: ["db flye", "db fly", "dumbbell fly", "chest fly", "chest flye"],
  },
  {
    canonicalName: "Push-Up",
    muscleGroup: "chest",
    movementPattern: "push",
    category: "compound",
    aliases: ["push up", "pushup", "push-ups", "pushups"],
  },
  {
    canonicalName: "Dip",
    muscleGroup: "chest",
    movementPattern: "push",
    category: "compound",
    aliases: ["dips", "chest dip", "chest dips", "bar dip", "bar dips"],
  },

  // Shoulders (push)
  {
    canonicalName: "Overhead Press",
    muscleGroup: "shoulders",
    movementPattern: "push",
    category: "compound",
    aliases: [
      "ohp",
      "military press",
      "standing press",
      "barbell overhead press",
      "barbell shoulder press",
    ],
  },
  {
    canonicalName: "Dumbbell Shoulder Press",
    muscleGroup: "shoulders",
    movementPattern: "push",
    category: "compound",
    aliases: ["db shoulder press", "seated db press", "db overhead press"],
  },
  {
    canonicalName: "Arnold Press",
    muscleGroup: "shoulders",
    movementPattern: "push",
    category: "compound",
    aliases: ["arnold presses"],
  },
  {
    canonicalName: "Lateral Raise",
    muscleGroup: "shoulders",
    movementPattern: "push",
    category: "isolation",
    aliases: [
      "lateral raises",
      "side raise",
      "side raises",
      "db lateral raise",
    ],
  },
  {
    canonicalName: "Front Raise",
    muscleGroup: "shoulders",
    movementPattern: "push",
    category: "isolation",
    aliases: ["front raises", "db front raise"],
  },

  // Back (pull)
  {
    canonicalName: "Pull-Up",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "compound",
    aliases: ["pull up", "pullup", "pull ups", "pullups", "pull-ups"],
  },
  {
    canonicalName: "Chin-Up",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "compound",
    aliases: ["chin up", "chinup", "chin ups", "chinups", "chin-ups"],
  },
  {
    canonicalName: "Barbell Row",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "compound",
    aliases: [
      "bent over row",
      "bb row",
      "pendlay row",
      "barbell bent over row",
    ],
  },
  {
    canonicalName: "Dumbbell Row",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "compound",
    aliases: [
      "db row",
      "one arm row",
      "single arm row",
      "single-arm dumbbell row",
      "bent over db row",
    ],
  },
  {
    canonicalName: "Inverted Row",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "compound",
    aliases: ["inverted rows", "bodyweight row", "body weight row"],
  },
  {
    canonicalName: "Lat Pulldown",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "compound",
    aliases: ["lat pull down", "pulldown"],
  },
  {
    canonicalName: "Face Pull",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "isolation",
    aliases: ["face pulls", "band face pull"],
  },
  {
    canonicalName: "Barbell Deadlift",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "compound",
    aliases: ["deadlift", "deadlifts", "conventional deadlift"],
  },
  {
    canonicalName: "Rack Pull",
    muscleGroup: "back",
    movementPattern: "pull",
    category: "compound",
    aliases: ["rack pulls"],
  },

  // Legs (legs)
  {
    canonicalName: "Back Squat",
    muscleGroup: "quads",
    movementPattern: "legs",
    category: "compound",
    aliases: ["squat", "squats", "barbell squat", "barbell back squat"],
  },
  {
    canonicalName: "Front Squat",
    muscleGroup: "quads",
    movementPattern: "legs",
    category: "compound",
    aliases: ["front squats"],
  },
  {
    canonicalName: "Goblet Squat",
    muscleGroup: "quads",
    movementPattern: "legs",
    category: "compound",
    aliases: ["goblet squats", "db goblet squat"],
  },
  {
    canonicalName: "Bulgarian Split Squat",
    muscleGroup: "quads",
    movementPattern: "legs",
    category: "compound",
    aliases: [
      "bulgarian split squats",
      "rear foot elevated split squat",
      "rfess",
    ],
  },
  {
    canonicalName: "Walking Lunge",
    muscleGroup: "quads",
    movementPattern: "legs",
    category: "compound",
    aliases: [
      "walking lunges",
      "dumbbell lunge",
      "db lunge",
      "lunges",
      "lunge",
    ],
  },
  {
    canonicalName: "Leg Press",
    muscleGroup: "quads",
    movementPattern: "legs",
    category: "compound",
    aliases: ["leg presses"],
  },
  {
    canonicalName: "Trap Bar Deadlift",
    muscleGroup: "quads",
    movementPattern: "legs",
    category: "compound",
    aliases: ["trap bar deadlifts", "hex bar deadlift", "hex bar deadlifts"],
  },
  {
    canonicalName: "Romanian Deadlift",
    muscleGroup: "hamstrings",
    movementPattern: "legs",
    category: "compound",
    aliases: ["rdl", "rdls", "romanian deadlifts", "dumbbell rdl", "db rdl"],
  },
  {
    canonicalName: "Leg Curl",
    muscleGroup: "hamstrings",
    movementPattern: "legs",
    category: "isolation",
    aliases: ["leg curls", "hamstring curl", "hamstring curls"],
  },
  {
    canonicalName: "Hip Thrust",
    muscleGroup: "glutes",
    movementPattern: "legs",
    category: "compound",
    aliases: [
      "hip thrusts",
      "barbell hip thrust",
      "glute bridge",
      "glute bridges",
    ],
  },
  {
    canonicalName: "Standing Calf Raise",
    muscleGroup: "calves",
    movementPattern: "legs",
    category: "isolation",
    aliases: ["calf raise", "calf raises", "standing calf raises"],
  },
  {
    canonicalName: "Seated Calf Raise",
    muscleGroup: "calves",
    movementPattern: "legs",
    category: "isolation",
    aliases: ["seated calf raises"],
  },

  // Arms (biceps = pull, triceps = push)
  {
    canonicalName: "Barbell Curl",
    muscleGroup: "biceps",
    movementPattern: "pull",
    category: "isolation",
    aliases: [
      "bb curl",
      "barbell curls",
      "bicep curl",
      "bicep curls",
      "curls",
      "curl",
    ],
  },
  {
    canonicalName: "Dumbbell Curl",
    muscleGroup: "biceps",
    movementPattern: "pull",
    category: "isolation",
    aliases: ["db curl", "dumbbell curls", "db curls"],
  },
  {
    canonicalName: "Hammer Curl",
    muscleGroup: "biceps",
    movementPattern: "pull",
    category: "isolation",
    aliases: ["hammer curls", "db hammer curl"],
  },
  {
    canonicalName: "Incline Dumbbell Curl",
    muscleGroup: "biceps",
    movementPattern: "pull",
    category: "isolation",
    aliases: ["incline curl", "incline curls", "incline db curl"],
  },
  {
    canonicalName: "Tricep Extension",
    muscleGroup: "triceps",
    movementPattern: "push",
    category: "isolation",
    aliases: [
      "triceps extension",
      "overhead tricep extension",
      "overhead triceps extension",
      "skull crusher",
      "skull crushers",
      "skullcrusher",
    ],
  },
  {
    canonicalName: "Close-Grip Bench Press",
    muscleGroup: "triceps",
    movementPattern: "push",
    category: "compound",
    aliases: ["close grip bench press", "close grip bench", "cgbp"],
  },
  {
    canonicalName: "Tricep Pushdown",
    muscleGroup: "triceps",
    movementPattern: "push",
    category: "isolation",
    aliases: ["triceps pushdown", "cable pushdown", "pushdown"],
  },

  // Core
  {
    canonicalName: "Plank",
    muscleGroup: "core",
    movementPattern: "core",
    category: "isolation",
    aliases: ["planks", "front plank"],
  },
  {
    canonicalName: "Hanging Leg Raise",
    muscleGroup: "core",
    movementPattern: "core",
    category: "isolation",
    aliases: ["hanging leg raises", "leg raise", "leg raises"],
  },
  {
    canonicalName: "Ab Wheel Rollout",
    muscleGroup: "core",
    movementPattern: "core",
    category: "isolation",
    aliases: ["ab wheel", "ab rollout", "ab rollouts"],
  },
  {
    canonicalName: "Sit-Up",
    muscleGroup: "core",
    movementPattern: "core",
    category: "isolation",
    aliases: ["sit up", "situp", "sit ups", "situps", "sit-ups"],
  },
  {
    canonicalName: "Crunch",
    muscleGroup: "core",
    movementPattern: "core",
    category: "isolation",
    aliases: ["crunches"],
  },
  {
    canonicalName: "Russian Twist",
    muscleGroup: "core",
    movementPattern: "core",
    category: "isolation",
    aliases: ["russian twists"],
  },
  {
    canonicalName: "Dead Bug",
    muscleGroup: "core",
    movementPattern: "core",
    category: "isolation",
    aliases: ["dead bugs"],
  },
];

function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim().replace(/[-_.]/g, " ").replace(/\s+/g, " ");
}

const CATALOG_LOOKUP = new Map<string, ExerciseCatalogEntry>();
for (const entry of EXERCISE_CATALOG) {
  CATALOG_LOOKUP.set(normalizeExerciseName(entry.canonicalName), entry);
  for (const alias of entry.aliases) {
    CATALOG_LOOKUP.set(normalizeExerciseName(alias), entry);
  }
}

/**
 * Resolves a free-text exercise name (as logged by the user) to its
 * canonical catalog entry, or `null` if the exercise isn't in the catalog
 * and has no user override (e.g. a custom/uncommon movement). Matching is
 * exact-after-normalization only — no fuzzy matching — to keep resolution
 * deterministic and testable.
 *
 * When `overrides` is provided (a per-user map built via
 * buildOverridesLookup()), it's checked *before* the built-in catalog, so a
 * user's own classification always wins over the shipped default for names
 * they've explicitly classified.
 */
export function resolveExercise(
  exerciseName: string,
  overrides?: ReadonlyMap<string, ExerciseCatalogEntry>,
): ExerciseCatalogEntry | null {
  const normalized = normalizeExerciseName(exerciseName);
  return overrides?.get(normalized) ?? CATALOG_LOOKUP.get(normalized) ?? null;
}

/**
 * Builds the per-user override lookup map consumed by resolveExercise().
 * Kept as a plain function (not baked into the service layer) so callers
 * that already have a list of overrides in hand — e.g. from a single
 * listActive() call shared across several computeMuscleGroupVolume() calls
 * in one request — can build the map once and reuse it.
 */
export function buildOverridesLookup(
  overrides: Pick<
    ExerciseMuscleGroupOverride,
    "normalizedName" | "exerciseName" | "muscleGroup" | "movementPattern" | "category"
  >[],
): Map<string, ExerciseCatalogEntry> {
  const lookup = new Map<string, ExerciseCatalogEntry>();
  for (const override of overrides) {
    lookup.set(override.normalizedName, {
      canonicalName: override.exerciseName,
      muscleGroup: override.muscleGroup,
      movementPattern: override.movementPattern,
      category: override.category,
      aliases: [],
    });
  }
  return lookup;
}

export { normalizeExerciseName };
