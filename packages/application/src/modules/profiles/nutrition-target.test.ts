import { describe, expect, it } from "vitest";
import type { BodyMetric, UserProfile } from "@fitness-app/domain";
import type { BodyMetricRepository } from "../body-metrics/body-metric";
import type {
  UpdateUserProfileInput,
  UserProfileRepository,
} from "./user-profile";
import { NutritionTargetService, computeAgeYears } from "./nutrition-target";

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
    heightCm: null,
    birthDate: null,
    biologicalSex: null,
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

describe("TD-030 personalization", () => {
  const at = () => new Date("2026-08-27T12:00:00.000Z");

  function serviceFor(
    profileOverrides: Partial<UserProfile>,
    metrics = [makeBodyMetric({ weightKg: 80 })],
  ) {
    return new NutritionTargetService(
      new FakeProfileRepository(makeProfile(profileOverrides)),
      new FakeBodyMetricRepository(metrics),
      at,
    );
  }

  it("uses the profile's own height, age, and sex when all are present", async () => {
    // Mifflin-St Jeor, male: 10*80 + 6.25*180 - 5*36 + 5 = 1750 BMR.
    const targets = await serviceFor({
      heightCm: 180,
      birthDate: "1990-01-15",
      biologicalSex: "male",
    }).computeNutritionTargets(userId);

    // Population defaults (170cm, 30yo) would give 1730 — a different number.
    const withDefaults = await serviceFor({}).computeNutritionTargets(userId);
    expect(targets.dailyCaloriesTarget).not.toBe(
      withDefaults.dailyCaloriesTarget,
    );
    expect(
      targets.notes.some((note) => note.includes("population average")),
    ).toBe(false);
    expect(targets.notes.some((note) => note.includes("your own height"))).toBe(
      true,
    );
  });

  it("applies the female constant rather than defaulting to male", async () => {
    const female = await serviceFor({
      heightCm: 165,
      birthDate: "1990-01-15",
      biologicalSex: "female",
    }).computeNutritionTargets(userId);
    const male = await serviceFor({
      heightCm: 165,
      birthDate: "1990-01-15",
      biologicalSex: "male",
    }).computeNutritionTargets(userId);

    // The two constants differ by 166 kcal of BMR before the activity
    // multiplier, so these must not collapse to the same target.
    expect(female.dailyCaloriesTarget).toBeLessThan(male.dailyCaloriesTarget);
  });

  it("names exactly the fields that fell back to a population average", async () => {
    const targets = await serviceFor({
      heightCm: 180,
      birthDate: null,
      biologicalSex: null,
    }).computeNutritionTargets(userId);

    const note = targets.notes.find((n) => n.includes("population average"));
    expect(note).toBeDefined();
    expect(note).toContain("age");
    expect(note).toContain("biological sex");
    expect(note).not.toContain("height");
  });

  it("treats an explicit 'unspecified' as no usable sex, and says so", async () => {
    // Declining to answer is a real choice, but the formula still has no
    // sex-specific constant to use — it must not quietly assume male.
    const unspecified = await serviceFor({
      heightCm: 175,
      birthDate: "1990-01-15",
      biologicalSex: "unspecified",
    }).computeNutritionTargets(userId);
    const male = await serviceFor({
      heightCm: 175,
      birthDate: "1990-01-15",
      biologicalSex: "male",
    }).computeNutritionTargets(userId);

    expect(unspecified.dailyCaloriesTarget).not.toBe(male.dailyCaloriesTarget);
    expect(
      unspecified.notes.some((note) => note.includes("biological sex")),
    ).toBe(true);
  });

  it("derives age from the birth date, including before the birthday", async () => {
    // Born 1990-12-01, evaluated 2026-08-27: birthday not yet reached, so 35.
    const beforeBirthday = computeAgeYears("1990-12-01", at());
    // Born 1990-01-15: birthday passed, so 36.
    const afterBirthday = computeAgeYears("1990-01-15", at());

    expect(beforeBirthday).toBe(35);
    expect(afterBirthday).toBe(36);
  });

  it("falls back to the default age for an unusable birth date", async () => {
    // A future date (or anything implausible) must not feed a negative age
    // into the formula.
    expect(computeAgeYears("2030-01-01", at())).toBeNull();
    expect(computeAgeYears("not-a-date", at())).toBeNull();

    const targets = await serviceFor({
      heightCm: 180,
      birthDate: "2030-01-01",
      biologicalSex: "male",
    }).computeNutritionTargets(userId);

    expect(
      targets.notes.some(
        (note) => note.includes("population average") && note.includes("age"),
      ),
    ).toBe(true);
  });

  it("still applies the safety floor when real stats produce a low target", async () => {
    const targets = await serviceFor(
      {
        heightCm: 150,
        birthDate: "1950-01-15",
        biologicalSex: "female",
        goalFatLoss: true,
      },
      [makeBodyMetric({ weightKg: 40 })],
    ).computeNutritionTargets(userId);

    expect(targets.safetyFloorApplied).toBe(true);
    expect(targets.dailyCaloriesTarget).toBe(1200);
  });
});
