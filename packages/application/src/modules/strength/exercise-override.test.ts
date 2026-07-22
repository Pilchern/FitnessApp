import { describe, expect, it } from "vitest";
import type { ExerciseMuscleGroupOverride } from "@fitness-app/domain";
import type {
  ClassifyExerciseInput,
  ExerciseOverrideRepository,
} from "./exercise-override";
import { ExerciseOverrideService } from "./exercise-override";

const userId = "11111111-1111-4111-8111-111111111111";

class FakeExerciseOverrideRepository implements ExerciseOverrideRepository {
  public overrides: ExerciseMuscleGroupOverride[] = [];

  async upsert(
    input: ClassifyExerciseInput,
  ): Promise<ExerciseMuscleGroupOverride> {
    const existing = this.overrides.find(
      (o) =>
        o.userId === input.userId && o.normalizedName === input.normalizedName,
    );

    if (existing) {
      existing.exerciseName = input.exerciseName;
      existing.muscleGroup = input.muscleGroup;
      existing.movementPattern = input.movementPattern;
      existing.category = input.category;
      existing.deletedAt = null;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    const created: ExerciseMuscleGroupOverride = {
      id: `override-${this.overrides.length + 1}`,
      userId: input.userId,
      exerciseName: input.exerciseName,
      normalizedName: input.normalizedName,
      muscleGroup: input.muscleGroup,
      movementPattern: input.movementPattern,
      category: input.category,
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
      deletedAt: null,
    };
    this.overrides.push(created);
    return created;
  }

  async archive(userId: string, id: string): Promise<void> {
    const found = this.overrides.find(
      (o) => o.userId === userId && o.id === id,
    );
    if (found) {
      found.deletedAt = new Date().toISOString();
    }
  }

  async listActive(userId: string): Promise<ExerciseMuscleGroupOverride[]> {
    return this.overrides.filter(
      (o) => o.userId === userId && o.deletedAt === null,
    );
  }
}

describe("ExerciseOverrideService", () => {
  it("classifies a new exercise and normalizes its name for lookup", async () => {
    const repository = new FakeExerciseOverrideRepository();
    const service = new ExerciseOverrideService(repository);

    const result = await service.classify({
      userId,
      exerciseName: "  Some-Custom Cable_Thing  ",
      muscleGroup: "back",
      movementPattern: "pull",
      category: "isolation",
    });

    expect(result.normalizedName).toBe("some custom cable thing");
    expect(result.exerciseName).toBe("Some-Custom Cable_Thing");
  });

  it("rejects an invalid muscle group", async () => {
    const repository = new FakeExerciseOverrideRepository();
    const service = new ExerciseOverrideService(repository);

    await expect(
      service.classify({
        userId,
        exerciseName: "Custom Thing",
        muscleGroup: "forearms",
        movementPattern: "pull",
        category: "isolation",
      }),
    ).rejects.toThrow();
  });

  it("re-classifying the same exercise name upserts rather than duplicates", async () => {
    const repository = new FakeExerciseOverrideRepository();
    const service = new ExerciseOverrideService(repository);

    await service.classify({
      userId,
      exerciseName: "Custom Thing",
      muscleGroup: "back",
      movementPattern: "pull",
      category: "isolation",
    });
    await service.classify({
      userId,
      exerciseName: "Custom Thing",
      muscleGroup: "chest",
      movementPattern: "push",
      category: "compound",
    });

    const active = await service.listActive({ userId });
    expect(active).toHaveLength(1);
    expect(active[0]?.muscleGroup).toBe("chest");
  });

  it("archive removes an override from listActive", async () => {
    const repository = new FakeExerciseOverrideRepository();
    const service = new ExerciseOverrideService(repository);

    const created = await service.classify({
      userId,
      exerciseName: "Custom Thing",
      muscleGroup: "back",
      movementPattern: "pull",
      category: "isolation",
    });

    await service.archive(userId, created.id);

    expect(await service.listActive({ userId })).toEqual([]);
  });
});
