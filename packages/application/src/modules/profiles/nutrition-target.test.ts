import { describe, expect, it } from "vitest";
import type { BodyMetric, UserProfile } from "@fitness-app/domain";
import type { BodyMetricRepository } from "../body-metrics/body-metric";
import type {
  UpdateUserProfileInput,
  UserProfileRepository,
} from "./user-profile";
import { NutritionTargetService } from "./nutrition-target";

const userId = "11111111-1111-4111-8111-111111111111";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "profile-1",
    userId,
    displayName: "Athlete",
    timezone: "UTC",
    unitsSystem: "imperial",
    weekStartsOn: 1,
    goalFatLoss: false,
    goalPreserveMuscle: false,
    goalImproveVo2: false,
    dailyProteinGramsTarget: null,
    dailyCaloriesTarget: null,
    dailyFiberGramsTarget: null,
    targetWeightLb: null,
    targetDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeBodyMetric(overrides: Partial<BodyMetric> = {}): BodyMetric {
  return {
    id: "metric-1",
    userId,
    measuredOn: "2026-07-01",
    weightLb: null,
    weightKg: null,
    waistIn: null,
    waistCm: null,
    waistHipIn: null,
    waistGutIn: null,
    bodyFatPct: null,
    muscleMassLb: null,
    muscleMassKg: null,
    boneMassKg: null,
    boneMassLb: null,
    fatFreeMassKg: null,
    fatFreeMassLb: null,
    hydrationPct: null,
    visceralFatIndex: null,
    notes: null,
    source: { sourceType: "manual" },
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as BodyMetric;
}

class FakeProfileRepository implements UserProfileRepository {
  constructor(private readonly profile: UserProfile | null) {}

  async findByUserId(): Promise<UserProfile | null> {
    return this.profile;
  }

  async update(input: UpdateUserProfileInput): Promise<UserProfile> {
    if (!this.profile) throw new Error("no profile");
    return { ...this.profile, ...input };
  }
}

class FakeBodyMetricRepository implements BodyMetricRepository {
  constructor(private readonly metrics: BodyMetric[]) {}

  async create(): Promise<BodyMetric> {
    throw new Error("not implemented");
  }
  async upsertImported(): Promise<BodyMetric> {
    throw new Error("not implemented");
  }
  async update(): Promise<BodyMetric> {
    throw new Error("not implemented");
  }
  async archive(): Promise<void> {
    throw new Error("not implemented");
  }
  async findById(): Promise<BodyMetric | null> {
    return null;
  }
  async listByDateRange(): Promise<BodyMetric[]> {
    return this.metrics;
  }
}

describe("NutritionTargetService.computeNutritionTargets", () => {
  it("throws when the profile does not exist", async () => {
    const service = new NutritionTargetService(
      new FakeProfileRepository(null),
      new FakeBodyMetricRepository([]),
    );

    await expect(service.computeNutritionTargets(userId)).rejects.toThrow(
      "Profile not found",
    );
  });

  it("uses a default weight and flags it when no body metric has weight logged", async () => {
    const service = new NutritionTargetService(
      new FakeProfileRepository(makeProfile()),
      new FakeBodyMetricRepository([makeBodyMetric()]),
    );

    const targets = await service.computeNutritionTargets(userId);

    expect(
      targets.notes.some((note) => note.includes("No logged body weight")),
    ).toBe(true);
  });

  it("uses the most recent logged weight in kg when available", async () => {
    const service = new NutritionTargetService(
      new FakeProfileRepository(makeProfile()),
      new FakeBodyMetricRepository([makeBodyMetric({ weightKg: 90 })]),
    );

    const targets = await service.computeNutritionTargets(userId);

    // protein target is 1.8g/kg rounded to nearest 5
    expect(targets.dailyProteinGramsTarget).toBe(160);
    expect(
      targets.notes.some((note) => note.includes("No logged body weight")),
    ).toBe(false);
  });

  it("converts a logged weight in lb to kg for the calculation", async () => {
    const service = new NutritionTargetService(
      new FakeProfileRepository(makeProfile()),
      new FakeBodyMetricRepository([makeBodyMetric({ weightLb: 198.4 })]),
    );

    const targets = await service.computeNutritionTargets(userId);

    // 198.4 lb ≈ 90 kg -> same protein target as the kg-based test above
    expect(targets.dailyProteinGramsTarget).toBe(160);
  });

  it("applies a fat-loss deficit relative to maintenance", async () => {
    const maintenanceService = new NutritionTargetService(
      new FakeProfileRepository(makeProfile({ goalFatLoss: false })),
      new FakeBodyMetricRepository([makeBodyMetric({ weightKg: 90 })]),
    );
    const fatLossService = new NutritionTargetService(
      new FakeProfileRepository(makeProfile({ goalFatLoss: true })),
      new FakeBodyMetricRepository([makeBodyMetric({ weightKg: 90 })]),
    );

    const maintenance =
      await maintenanceService.computeNutritionTargets(userId);
    const fatLoss = await fatLossService.computeNutritionTargets(userId);

    expect(fatLoss.dailyCaloriesTarget).toBeLessThan(
      maintenance.dailyCaloriesTarget,
    );
  });

  it("never returns a calorie target below the safe minimum, regardless of how low the formula's raw output is", async () => {
    const service = new NutritionTargetService(
      new FakeProfileRepository(makeProfile({ goalFatLoss: true })),
      // An extreme low weight (below any realistic adult body weight) is used to
      // deterministically drive the raw fat-loss deficit below the safety floor —
      // this exercises the clamp's boundary logic directly rather than relying on
      // a value that happens to trigger it under today's fixed age/height defaults.
      new FakeBodyMetricRepository([makeBodyMetric({ weightKg: 10 })]),
    );

    const targets = await service.computeNutritionTargets(userId);

    expect(targets.dailyCaloriesTarget).toBeGreaterThanOrEqual(1200);
    expect(targets.safetyFloorApplied).toBe(true);
    expect(targets.notes.some((note) => note.includes("safe minimum"))).toBe(
      true,
    );
  });

  it("does not flag the safety floor for a typical maintenance target", async () => {
    const service = new NutritionTargetService(
      new FakeProfileRepository(makeProfile()),
      new FakeBodyMetricRepository([makeBodyMetric({ weightKg: 90 })]),
    );

    const targets = await service.computeNutritionTargets(userId);

    expect(targets.safetyFloorApplied).toBe(false);
  });

  it("always includes a rough-estimate disclaimer note", async () => {
    const service = new NutritionTargetService(
      new FakeProfileRepository(makeProfile()),
      new FakeBodyMetricRepository([makeBodyMetric({ weightKg: 90 })]),
    );

    const targets = await service.computeNutritionTargets(userId);

    expect(
      targets.notes.some((note) =>
        note.toLowerCase().includes("rough starting point"),
      ),
    ).toBe(true);
  });
});
