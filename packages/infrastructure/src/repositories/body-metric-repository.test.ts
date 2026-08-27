import { describe, expect, it } from "vitest";
import { mapBodyMetricRow } from "./body-metric-repository";

/**
 * `mapBodyMetricRow` is 17 `number | null` fields, ten of them `*Lb`/`*Kg` or
 * `*In`/`*Cm` pairs. TypeScript cannot tell `boneMassKg: row.bone_mass_lb`
 * from the correct mapping — both are `number | null` — so a transposition is
 * invisible at compile time and silently corrupts every read.
 *
 * It matters most for weight: `weightLb`/`weightKg` feed
 * `NutritionTargetService`'s calorie and protein calculation, so a swap there
 * produces a wrong daily target with nothing to catch it. The row schema also
 * orders the pairs inconsistently (`muscle_mass_lb, muscle_mass_kg` but
 * `bone_mass_kg, bone_mass_lb`), which is exactly the seam a copy-paste error
 * would slip through.
 *
 * So every field gets a distinct value here: any two fields swapped changes
 * the result.
 */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    measured_on: "2026-08-10",
    weight_lb: 101,
    weight_kg: 102,
    waist_in: 103,
    waist_cm: 104,
    waist_hip_in: 105,
    waist_gut_in: 106,
    body_fat_pct: 17,
    muscle_mass_lb: 108,
    muscle_mass_kg: 109,
    bone_mass_kg: 110,
    bone_mass_lb: 111,
    fat_free_mass_kg: 112,
    fat_free_mass_lb: 113,
    hydration_pct: 54,
    visceral_fat_index: 8,
    notes: "morning weigh-in",
    source_type: "imported" as const,
    source_provider: "withings",
    source_external_id: "ext-1",
    import_batch_id: "33333333-3333-4333-8333-333333333333",
    raw_import_event_id: "44444444-4444-4444-8444-444444444444",
    created_at: "2026-08-10T12:00:00.000Z",
    updated_at: "2026-08-10T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("mapBodyMetricRow", () => {
  it("maps every column to its own field, with no pair transposed", () => {
    expect(mapBodyMetricRow(row() as never)).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      measuredOn: "2026-08-10",
      weightLb: 101,
      weightKg: 102,
      waistIn: 103,
      waistCm: 104,
      waistHipIn: 105,
      waistGutIn: 106,
      bodyFatPct: 17,
      muscleMassLb: 108,
      muscleMassKg: 109,
      boneMassKg: 110,
      boneMassLb: 111,
      fatFreeMassKg: 112,
      fatFreeMassLb: 113,
      hydrationPct: 54,
      visceralFatIndex: 8,
      notes: "morning weigh-in",
      source: {
        sourceType: "imported",
        sourceProvider: "withings",
        sourceExternalId: "ext-1",
        importBatchId: "33333333-3333-4333-8333-333333333333",
        rawImportEventId: "44444444-4444-4444-8444-444444444444",
      },
      createdAt: "2026-08-10T12:00:00.000Z",
      updatedAt: "2026-08-10T12:00:00.000Z",
      deletedAt: null,
    });
  });

  it("keeps lb and kg on their own fields", () => {
    // Called out separately because weightLb/weightKg reach the nutrition
    // calculation: a swap here is a wrong calorie target, not a wrong chart.
    const mapped = mapBodyMetricRow(
      row({ weight_lb: 180, weight_kg: 81.6 }) as never,
    );

    expect(mapped.weightLb).toBe(180);
    expect(mapped.weightKg).toBe(81.6);
  });

  it("preserves nulls rather than coercing them to zero", () => {
    // A null weight means "not measured". Zero would read as a real
    // measurement and drag any average or trend toward it.
    const mapped = mapBodyMetricRow(
      row({ weight_lb: null, weight_kg: null, body_fat_pct: null }) as never,
    );

    expect(mapped.weightLb).toBeNull();
    expect(mapped.weightKg).toBeNull();
    expect(mapped.bodyFatPct).toBeNull();
  });

  it("carries a soft-delete timestamp through", () => {
    // Cross-provider dedup and the tombstone checks both read deletedAt.
    const mapped = mapBodyMetricRow(
      row({ deleted_at: "2026-08-11T00:00:00.000Z" }) as never,
    );

    expect(mapped.deletedAt).toBe("2026-08-11T00:00:00.000Z");
  });

  it("maps a manual row with no provenance", () => {
    const mapped = mapBodyMetricRow(
      row({
        source_type: "manual",
        source_provider: null,
        source_external_id: null,
        import_batch_id: null,
        raw_import_event_id: null,
      }) as never,
    );

    expect(mapped.source).toEqual({
      sourceType: "manual",
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    });
  });
});
