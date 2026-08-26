import { describe, expect, it } from "vitest";
import { buildOverridesLookup, resolveExercise } from "./exercise-catalog-data";

describe("resolveExercise", () => {
  it("resolves canonical exercise names", () => {
    const entry = resolveExercise("Barbell Bench Press");
    expect(entry?.canonicalName).toBe("Barbell Bench Press");
    expect(entry?.muscleGroup).toBe("chest");
    expect(entry?.movementPattern).toBe("push");
  });

  it("resolves aliases with different casing and punctuation to the same canonical entry", () => {
    const variants = ["DB Bench", "db bench press", "Dumbbell Bench"];
    for (const variant of variants) {
      const entry = resolveExercise(variant);
      expect(entry?.canonicalName).toBe("Dumbbell Bench Press");
    }
  });

  it("collapses extra whitespace and hyphens before matching", () => {
    const entry = resolveExercise("  pull-ups  ");
    expect(entry?.canonicalName).toBe("Pull-Up");
  });

  it("classifies back squat as a leg exercise, not a back exercise", () => {
    const entry = resolveExercise("squats");
    expect(entry?.canonicalName).toBe("Back Squat");
    expect(entry?.muscleGroup).toBe("quads");
    expect(entry?.movementPattern).toBe("legs");
  });

  it("returns null for an exercise not in the catalog", () => {
    expect(resolveExercise("Some Made Up Machine Exercise")).toBeNull();
  });

  it("resolves via an override for a name the catalog doesn't recognize", () => {
    const overrides = buildOverridesLookup([
      {
        normalizedName: "cable pull thing",
        exerciseName: "Cable Pull Thing",
        muscleGroup: "back",
        movementPattern: "pull",
        category: "isolation",
      },
    ]);

    expect(
      resolveExercise("Some Made Up Machine Exercise", overrides),
    ).toBeNull();
    const entry = resolveExercise("Cable Pull Thing", overrides);
    expect(entry?.muscleGroup).toBe("back");
    expect(entry?.movementPattern).toBe("pull");
  });

  it("prefers an override over the built-in catalog entry for the same name", () => {
    const overrides = buildOverridesLookup([
      {
        normalizedName: "barbell bench press",
        exerciseName: "Barbell Bench Press",
        muscleGroup: "shoulders",
        movementPattern: "push",
        category: "compound",
      },
    ]);

    const entry = resolveExercise("Barbell Bench Press", overrides);
    expect(entry?.muscleGroup).toBe("shoulders");
  });
});
