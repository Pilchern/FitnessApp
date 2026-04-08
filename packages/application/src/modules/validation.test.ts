import { describe, expect, it } from "vitest";
import {
  createBodyMetricSchema,
  createCardioSessionSchema,
  createRecoveryCheckinSchema,
  createWeeklyReviewSchema,
  updateJournalEntrySchema,
} from "../index";

const userId = "11111111-1111-4111-8111-111111111111";

describe("application validation schemas", () => {
  it("defaults cardio sessions to a manual source", () => {
    const parsed = createCardioSessionSchema.parse({
      userId,
      sessionDate: "2026-03-31",
      sessionKind: "zone2",
      durationMinutes: 50,
      zone2Minutes: 42,
    });

    expect(parsed.source).toEqual({
      sourceType: "manual",
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    });
    expect(parsed.plannedVsCompleted).toBe("completed");
  });

  it("rejects cardio sessions where zone2 minutes exceed duration", () => {
    expect(() =>
      createCardioSessionSchema.parse({
        userId,
        sessionDate: "2026-03-31",
        sessionKind: "zone2",
        durationMinutes: 30,
        zone2Minutes: 31,
      }),
    ).toThrow(/zone2Minutes/);
  });

  it("requires a provider when a recovery checkin source is mixed", () => {
    expect(() =>
      createRecoveryCheckinSchema.parse({
        userId,
        checkinDate: "2026-03-31",
        alcoholCount: 0,
        source: {
          sourceType: "mixed",
          sourceProvider: "",
        },
      }),
    ).toThrow();
  });

  it("rejects body metrics with impossible body fat percentages", () => {
    expect(() =>
      createBodyMetricSchema.parse({
        userId,
        measuredOn: "2026-03-31",
        bodyFatPct: 120,
      }),
    ).toThrow();
  });

  it("requires completedAt for completed weekly reviews", () => {
    expect(() =>
      createWeeklyReviewSchema.parse({
        userId,
        weekStart: "2026-03-23",
        weekEnd: "2026-03-29",
        status: "completed",
      }),
    ).toThrow(/completedAt/);
  });

  it("rejects journal entry updates without a patch payload", () => {
    expect(() =>
      updateJournalEntrySchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
        userId,
      }),
    ).toThrow(/At least one field/);
  });
});
