import { describe, expect, it } from "vitest";
import {
  createStrengthTemplateSchema,
  setTemplateScheduleSchema,
  strengthTemplateExerciseSchema,
} from "./training-template";

const userId = "11111111-1111-4111-8111-111111111111";
const templateId = "22222222-2222-4222-8222-222222222222";

describe("strengthTemplateExerciseSchema", () => {
  it("accepts the exact shape the strength-template creation form sends", () => {
    // Regression test: the web form (buildExercisesPayload in
    // strength-template-form.tsx) sends exerciseName/exerciseOrder/targetSets/
    // targetReps/targetWeight/targetRir/notes. A previous mismatched web-layer
    // schema (name/sets/reps/rpe/notes) meant every template creation failed
    // validation. This confirms the shared application-layer schema accepts
    // the real payload shape.
    const parsed = strengthTemplateExerciseSchema.parse({
      exerciseName: "Barbell Bench Press",
      exerciseOrder: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeight: 135,
      targetRir: 2,
      notes: null,
    });

    expect(parsed.exerciseName).toBe("Barbell Bench Press");
    expect(parsed.targetSets).toBe(3);
  });

  it("rejects a target weight that is obviously a data-entry error", () => {
    expect(() =>
      strengthTemplateExerciseSchema.parse({
        exerciseName: "Barbell Bench Press",
        exerciseOrder: 0,
        targetSets: 3,
        targetReps: 8,
        targetWeight: 99999,
        targetRir: 2,
        notes: null,
      }),
    ).toThrow(/Target weight must be 2000 or less/);
  });
});

describe("createStrengthTemplateSchema", () => {
  const definition = {
    exercises: [
      {
        exerciseName: "Barbell Bench Press",
        exerciseOrder: 0,
        targetSets: 3,
        targetReps: 8,
        targetWeight: 135,
        targetRir: 2,
        notes: null,
      },
    ],
    notes: null,
  };

  it("accepts a template with no scheduled day", () => {
    const parsed = createStrengthTemplateSchema.parse({
      userId,
      name: "Push Day",
      definition,
    });

    expect(parsed.scheduledDayOfWeek).toBeUndefined();
  });

  it("accepts a template pinned to a valid day of week", () => {
    const parsed = createStrengthTemplateSchema.parse({
      userId,
      name: "Push Day",
      definition,
      scheduledDayOfWeek: 1,
    });

    expect(parsed.scheduledDayOfWeek).toBe(1);
  });

  it("rejects an out-of-range day of week", () => {
    expect(() =>
      createStrengthTemplateSchema.parse({
        userId,
        name: "Push Day",
        definition,
        scheduledDayOfWeek: 7,
      }),
    ).toThrow();
  });
});

describe("setTemplateScheduleSchema", () => {
  it("accepts clearing the schedule with null", () => {
    const parsed = setTemplateScheduleSchema.parse({
      userId,
      id: templateId,
      scheduledDayOfWeek: null,
    });

    expect(parsed.scheduledDayOfWeek).toBeNull();
  });

  it("accepts a valid day of week", () => {
    const parsed = setTemplateScheduleSchema.parse({
      userId,
      id: templateId,
      scheduledDayOfWeek: 5,
    });

    expect(parsed.scheduledDayOfWeek).toBe(5);
  });
});
