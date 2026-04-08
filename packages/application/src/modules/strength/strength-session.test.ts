import { describe, expect, it } from "vitest";
import type { StrengthSession } from "@fitness-app/domain";
import {
  buildStrengthProgressionSummaries,
  buildTopSetProgression,
  buildVolumeTrend,
  createStrengthSessionSchema,
  detectRepeatedStall,
  StrengthSessionService,
  type StrengthSessionRepository,
} from "../../index";

const userId = "11111111-1111-4111-8111-111111111111";

class FakeStrengthSessionRepository implements StrengthSessionRepository {
  public sessions: StrengthSession[] = [];

  async create(input: any) {
    const session: StrengthSession = {
      id: "session-1",
      userId: input.userId,
      trainingTemplateId: null,
      sessionDate: input.sessionDate,
      sessionName: input.sessionName ?? null,
      notes: input.notes ?? null,
      durationMinutes: input.durationMinutes ?? null,
      readinessPre: input.readinessPre ?? null,
      energyPost: input.energyPost ?? null,
      completedAsPlanned: input.completedAsPlanned,
      source: input.source,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      deletedAt: null,
      sets: input.sets.map((set: any, index: number) => ({
        id: `set-${index + 1}`,
        userId: input.userId,
        strengthSessionId: "session-1",
        exerciseName: set.exerciseName,
        exerciseOrder: set.exerciseOrder,
        setNumber: set.setNumber,
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        rir: set.rir ?? null,
        notes: set.notes ?? null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        deletedAt: null,
      })),
    };
    this.sessions.push(session);
    return session;
  }

  async update(input: any) {
    const created = await this.create(input);
    return {
      ...created,
      id: input.id,
      sets: created.sets.map((set) => ({ ...set, strengthSessionId: input.id })),
    };
  }

  async archive() {}

  async findById() {
    return null;
  }

  async listByDateRange() {
    return this.sessions;
  }
}

describe("strength validation", () => {
  it("requires at least one set", () => {
    expect(() =>
      createStrengthSessionSchema.parse({
        userId,
        sessionDate: "2026-04-01",
        sets: [],
      }),
    ).toThrow(/At least one set/);
  });

  it("accepts a valid strength session payload", () => {
    const parsed = createStrengthSessionSchema.parse({
      userId,
      sessionDate: "2026-04-01",
      sessionName: "Lower A",
      completedAsPlanned: true,
      sets: [
        {
          exerciseName: "Back Squat",
          exerciseOrder: 0,
          setNumber: 1,
          reps: 5,
          weight: 225,
        },
      ],
    });

    expect(parsed.sets).toHaveLength(1);
    expect(parsed.completedAsPlanned).toBe(true);
  });
});

describe("strength session save logic", () => {
  it("saves a validated session through the service boundary", async () => {
    const repository = new FakeStrengthSessionRepository();
    const service = new StrengthSessionService(repository);

    const saved = await service.create({
      userId,
      sessionDate: "2026-04-01",
      sessionName: "Upper A",
      completedAsPlanned: true,
      sets: [
        {
          exerciseName: "Bench Press",
          exerciseOrder: 0,
          setNumber: 1,
          reps: 5,
          weight: 185,
        },
      ],
    });

    expect(saved.sessionName).toBe("Upper A");
    expect(saved.sets[0].exerciseName).toBe("Bench Press");
  });
});

describe("strength progression helpers", () => {
  const sessions: StrengthSession[] = [
    {
      id: "session-1",
      userId,
      trainingTemplateId: null,
      sessionDate: "2026-03-17",
      sessionName: "Upper A",
      notes: null,
      durationMinutes: 60,
      readinessPre: null,
      energyPost: null,
      completedAsPlanned: true,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-17T00:00:00.000Z",
      updatedAt: "2026-03-17T00:00:00.000Z",
      deletedAt: null,
      sets: [
        {
          id: "set-1",
          userId,
          strengthSessionId: "session-1",
          exerciseName: "Bench Press",
          exerciseOrder: 0,
          setNumber: 1,
          reps: 5,
          weight: 185,
          rir: 2,
          notes: null,
          createdAt: "2026-03-17T00:00:00.000Z",
          updatedAt: "2026-03-17T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    },
    {
      id: "session-2",
      userId,
      trainingTemplateId: null,
      sessionDate: "2026-03-24",
      sessionName: "Upper A",
      notes: null,
      durationMinutes: 60,
      readinessPre: null,
      energyPost: null,
      completedAsPlanned: true,
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
      sets: [
        {
          id: "set-2",
          userId,
          strengthSessionId: "session-2",
          exerciseName: "Bench Press",
          exerciseOrder: 0,
          setNumber: 1,
          reps: 5,
          weight: 185,
          rir: 2,
          notes: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    },
    {
      id: "session-3",
      userId,
      trainingTemplateId: null,
      sessionDate: "2026-03-31",
      sessionName: "Upper A",
      notes: null,
      durationMinutes: 62,
      readinessPre: null,
      energyPost: null,
      completedAsPlanned: true,
      source: {
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      },
      createdAt: "2026-03-31T00:00:00.000Z",
      updatedAt: "2026-03-31T00:00:00.000Z",
      deletedAt: null,
      sets: [
        {
          id: "set-3",
          userId,
          strengthSessionId: "session-3",
          exerciseName: "Bench Press",
          exerciseOrder: 0,
          setNumber: 1,
          reps: 5,
          weight: 185,
          rir: 1,
          notes: null,
          createdAt: "2026-03-31T00:00:00.000Z",
          updatedAt: "2026-03-31T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    },
  ];

  it("builds volume and top set progression", () => {
    expect(buildVolumeTrend(sessions, "Bench Press")).toEqual([
      { sessionDate: "2026-03-17", totalVolume: 925 },
      { sessionDate: "2026-03-24", totalVolume: 925 },
      { sessionDate: "2026-03-31", totalVolume: 925 },
    ]);

    expect(buildTopSetProgression(sessions, "Bench Press")).toHaveLength(3);
  });

  it("detects repeated stalls and builds summaries", () => {
    const topSets = buildTopSetProgression(sessions, "Bench Press");
    expect(detectRepeatedStall(topSets)).toEqual({
      stalled: true,
      stagnantSessions: 3,
      explanation:
        "The last 3 top sets have not improved meaningfully, which is a simple stall signal.",
    });

    const summaries = buildStrengthProgressionSummaries(sessions);
    expect(summaries[0].exerciseName).toBe("Bench Press");
    expect(summaries[0].stall.stalled).toBe(true);
    expect(summaries[0].volumeTrend).toBe("flat");
  });
});
