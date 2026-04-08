import { describe, expect, it } from "vitest";
import {
  buildCardioAdherenceSummary,
  buildCardioWeeklyTotals,
  createCardioSessionSchema,
  updateCardioSessionSchema,
} from "../../index";
import type { CardioSession, TrainingTemplate } from "@fitness-app/domain";

const userId = "11111111-1111-4111-8111-111111111111";

describe("cardio validation", () => {
  it("applies default completion state for quick-add sessions", () => {
    const parsed = createCardioSessionSchema.parse({
      userId,
      sessionDate: "2026-03-31",
      sessionKind: "zone2",
      durationMinutes: 45,
    });

    expect(parsed.plannedVsCompleted).toBe("completed");
  });

  it("rejects cadence ranges where min exceeds max", () => {
    expect(() =>
      createCardioSessionSchema.parse({
        userId,
        sessionDate: "2026-03-31",
        sessionKind: "zone2",
        cadenceMin: 100,
        cadenceMax: 90,
      }),
    ).toThrow(/cadenceMax/);
  });

  it("rejects update payloads with no mutable fields", () => {
    expect(() =>
      updateCardioSessionSchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
        userId,
      }),
    ).toThrow(/At least one field/);
  });

  it("rejects RPE values above 10", () => {
    expect(() =>
      updateCardioSessionSchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
        userId,
        rpe: 11,
      }),
    ).toThrow();
  });
});

describe("cardio summaries", () => {
  const sessions: CardioSession[] = [
    {
      id: "session-1",
      userId,
      trainingTemplateId: "template-1",
      sessionDate: "2026-03-24",
      startedAt: null,
      endedAt: null,
      sessionKind: "zone2",
      plannedVsCompleted: "completed",
      durationMinutes: 50,
      zone2Minutes: 45,
      avgHeartRate: 135,
      maxHeartRate: 150,
      avgOutput: 178,
      cadenceMin: null,
      cadenceMax: null,
      resistanceMin: null,
      resistanceMax: null,
      intervalStructure: null,
      rpe: 6,
      distanceMeters: null,
      notes: null,
      sportType: null,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "session-2",
      userId,
      trainingTemplateId: "template-2",
      sessionDate: "2026-03-26",
      startedAt: null,
      endedAt: null,
      sessionKind: "vo2",
      plannedVsCompleted: "partial",
      durationMinutes: 32,
      zone2Minutes: 0,
      avgHeartRate: 152,
      maxHeartRate: 176,
      avgOutput: 220,
      cadenceMin: null,
      cadenceMax: null,
      resistanceMin: null,
      resistanceMax: null,
      intervalStructure: "4 x 4 / 3",
      rpe: 8,
      distanceMeters: null,
      notes: null,
      sportType: null,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-26T00:00:00.000Z",
      updatedAt: "2026-03-26T00:00:00.000Z",
      deletedAt: null,
    },
  ];

  const templates: TrainingTemplate[] = [
    {
      id: "template-1",
      userId,
      name: "Tuesday Zone 2",
      templateType: "cardio",
      isArchived: false,
      definition: {
        sessionKind: "zone2",
        targetDurationMinutes: 50,
      },
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "template-2",
      userId,
      name: "Thursday VO2",
      templateType: "cardio",
      isArchived: false,
      definition: {
        sessionKind: "vo2",
        targetDurationMinutes: 35,
      },
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
      deletedAt: null,
    },
  ];

  it("computes weekly totals from completed and partial sessions", () => {
    expect(buildCardioWeeklyTotals(sessions)).toEqual({
      completedSessions: 2,
      totalMinutes: 82,
      zone2Minutes: 45,
      vo2Sessions: 1,
      averageHeartRate: 144,
    });
  });

  it("builds current-week adherence against expected template days", () => {
    const summary = buildCardioAdherenceSummary(
      sessions,
      templates,
      new Date("2026-03-27T12:00:00.000Z"),
    );

    expect(summary.completedCount).toBe(2);
    expect(summary.expectedCount).toBe(2);
    expect(summary.items.map((item) => item.status)).toEqual([
      "completed",
      "completed",
      "pending",
    ]);
  });
});
