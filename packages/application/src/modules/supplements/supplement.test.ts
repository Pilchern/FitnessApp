import { describe, expect, it } from "vitest";
import type { Supplement, SupplementLog } from "@fitness-app/domain";
import {
  buildSupplementAdherenceSummary,
  createSupplementSchema,
  listSupplementsQuerySchema,
  logSupplementAdherenceSchema,
  stepHabitCompletions,
  stepHabitThreshold,
  supplementLogDateRangeQuerySchema,
  updateSupplementSchema,
} from "../../index";

const userId = "11111111-1111-4111-8111-111111111111";
const supplementId = "33333333-3333-4333-8333-333333333333";

describe("supplement validation", () => {
  it("trims and accepts a supplement name", () => {
    const parsed = createSupplementSchema.parse({
      userId,
      name: "  Creatine  ",
    });

    expect(parsed.name).toBe("Creatine");
  });

  it("defaults kind to supplement and accepts habit", () => {
    expect(
      createSupplementSchema.parse({ userId, name: "Creatine" }).kind,
    ).toBe("supplement");
    expect(
      createSupplementSchema.parse({
        userId,
        name: "Foundation Training",
        kind: "habit",
      }).kind,
    ).toBe("habit");
    expect(() =>
      createSupplementSchema.parse({ userId, name: "X", kind: "other" }),
    ).toThrow();
  });

  it("rejects a blank supplement name", () => {
    expect(() =>
      createSupplementSchema.parse({
        userId,
        name: "   ",
      }),
    ).toThrow();
  });

  it("rejects supplement updates with no fields to change", () => {
    expect(() =>
      updateSupplementSchema.parse({
        id: supplementId,
        userId,
      }),
    ).toThrow(/At least one field/);
  });

  it("accepts a deactivate-only update", () => {
    const parsed = updateSupplementSchema.parse({
      id: supplementId,
      userId,
      isActive: false,
    });

    expect(parsed.isActive).toBe(false);
    expect(parsed.name).toBeUndefined();
  });

  it("validates list query userId as a uuid", () => {
    expect(() =>
      listSupplementsQuerySchema.parse({ userId: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("supplement adherence logging validation", () => {
  it("accepts a taken=true log for a given date", () => {
    const parsed = logSupplementAdherenceSchema.parse({
      userId,
      supplementId,
      logDate: "2026-07-14",
      taken: true,
    });

    expect(parsed.taken).toBe(true);
  });

  it("accepts unlogging (taken=false)", () => {
    const parsed = logSupplementAdherenceSchema.parse({
      userId,
      supplementId,
      logDate: "2026-07-14",
      taken: false,
    });

    expect(parsed.taken).toBe(false);
  });

  it("rejects a malformed log date", () => {
    expect(() =>
      logSupplementAdherenceSchema.parse({
        userId,
        supplementId,
        logDate: "07/14/2026",
        taken: true,
      }),
    ).toThrow();
  });

  it("rejects a reversed date range", () => {
    expect(() =>
      supplementLogDateRangeQuerySchema.parse({
        userId,
        startDate: "2026-07-14",
        endDate: "2026-07-01",
      }),
    ).toThrow();
  });
});

describe("supplement adherence summary", () => {
  const supplements: Supplement[] = [
    {
      id: "supp-1",
      userId,
      name: "Creatine",
      kind: "supplement",
      isActive: true,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "supp-2",
      userId,
      name: "Vitamin D",
      kind: "supplement",
      isActive: true,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      deletedAt: null,
    },
  ];

  const logs: SupplementLog[] = [
    {
      id: "log-1",
      userId,
      supplementId: "supp-1",
      logDate: "2026-07-12",
      taken: true,
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "log-2",
      userId,
      supplementId: "supp-1",
      logDate: "2026-07-13",
      taken: false,
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "log-3",
      userId,
      supplementId: "supp-1",
      logDate: "2026-07-14",
      taken: true,
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
      deletedAt: null,
    },
  ];

  it("computes adherence % only over logged days, per supplement", () => {
    const summary = buildSupplementAdherenceSummary(supplements, logs);

    expect(summary).toEqual([
      {
        supplementId: "supp-1",
        name: "Creatine",
        takenCount: 2,
        loggedDayCount: 3,
        adherencePct: 66.7,
      },
      {
        supplementId: "supp-2",
        name: "Vitamin D",
        takenCount: 0,
        loggedDayCount: 0,
        adherencePct: null,
      },
    ]);
  });
});

describe("step habit auto-complete", () => {
  it("reads the step target from the habit name", () => {
    expect(stepHabitThreshold("7,000 steps")).toBe(7000);
    expect(stepHabitThreshold("Walk 8000 steps")).toBe(8000);
    expect(stepHabitThreshold("10k steps")).toBe(10000);
    expect(stepHabitThreshold("Mobility")).toBeNull();
    expect(stepHabitThreshold("Morning sunlight")).toBeNull();
  });

  it("completes only step habits on days at or over target", () => {
    const habits = [
      { id: "h1", name: "7,000 steps", kind: "habit" as const },
      { id: "h2", name: "Mobility", kind: "habit" as const },
      { id: "s1", name: "5000 steps vitamin", kind: "supplement" as const },
    ];
    expect(
      stepHabitCompletions(habits, [
        { date: "2026-10-08", steps: 7000 },
        { date: "2026-10-09", steps: 6999 },
        { date: "2026-10-10" },
      ]),
    ).toEqual([{ supplementId: "h1", logDate: "2026-10-08" }]);
  });
});
