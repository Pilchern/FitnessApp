import { describe, expect, it } from "vitest";
import { resolveExercise } from "./exercise-catalog-data";

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
});
