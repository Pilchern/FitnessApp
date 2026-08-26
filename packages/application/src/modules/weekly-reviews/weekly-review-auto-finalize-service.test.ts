import { describe, expect, it, vi } from "vitest";
import type {
  BodyMetric,
  CardioSession,
  JournalEntry,
  RecoveryCheckin,
  WeeklyReview,
  WeeklyReviewAiDraft,
} from "@fitness-app/domain";
import type { BodyMetricRepository } from "../body-metrics/body-metric";
import { BodyMetricService } from "../body-metrics/body-metric";
import type { CardioSessionRepository } from "../cardio/cardio-session";
import { CardioSessionService } from "../cardio/cardio-session";
import type { JournalEntryRepository } from "../journal/journal-entry";
import { JournalEntryService } from "../journal/journal-entry";
import type { RecoveryCheckinRepository } from "../recovery/recovery-checkin";
import { RecoveryCheckinService } from "../recovery/recovery-checkin";
import type { StrengthSessionSummaryRepository } from "../strength/strength-session-summary";
import { StrengthSessionSummaryService } from "../strength/strength-session-summary";
import type { AiWeeklyReviewService } from "./ai-weekly-review-service";
import type { WeeklyReviewRepository } from "./weekly-review";
import { WeeklyReviewService } from "./weekly-review";
import { WeeklyReviewAutoFinalizeService } from "./weekly-review-auto-finalize-service";

const userId = "11111111-1111-4111-8111-111111111111";

function makeReview(overrides: Partial<WeeklyReview> = {}): WeeklyReview {
  return {
    id: "review-1",
    userId,
    weekStart: "2026-07-06",
    weekEnd: "2026-07-12",
    status: "draft",
    summary: {
      averageWeightLb: null,
      waistIn: null,
      liftsCompleted: 2,
      ridesCompleted: 1,
      zone2Minutes: 30,
      vo2Completed: false,
      sleepAverageHours: 7.2,
      alcoholTotal: 1,
    },
    bestWin: null,
    biggestMiss: null,
    lesson: null,
    nextWeekPriority: null,
    confidence: null,
    scoreDetails: null,
    strategicDecision: null,
    riskForecast: null,
    manualOverrides: {},
    aiDraft: null,
    aiDraftStatus: "none",
    completedAt: null,
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

class FakeWeeklyReviewRepository implements WeeklyReviewRepository {
  public existing: WeeklyReview | null = null;
  public created: WeeklyReview[] = [];
  public updated: WeeklyReview[] = [];

  async create(input: any): Promise<WeeklyReview> {
    const review = makeReview({
      id: `22222222-2222-4222-8222-22222222222${this.created.length}`,
      userId: input.userId,
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
      summary: input.summary,
      status: input.status,
    });
    this.created.push(review);
    return review;
  }

  async update(input: any): Promise<WeeklyReview> {
    const base =
      this.existing ?? this.created[this.created.length - 1] ?? makeReview();
    const updated = { ...base, ...input };
    this.updated.push(updated);
    return updated;
  }

  async findById(): Promise<WeeklyReview | null> {
    return null;
  }

  async findByWeekStart(): Promise<WeeklyReview | null> {
    return this.existing;
  }

  async findLatest(): Promise<WeeklyReview | null> {
    return this.existing;
  }

  async listRecent(): Promise<WeeklyReview[]> {
    return this.existing ? [this.existing] : [];
  }
}

class FakeJournalEntryRepository implements JournalEntryRepository {
  public existingEntries: JournalEntry[] = [];
  public created: unknown[] = [];

  async create(input: any): Promise<JournalEntry> {
    this.created.push(input);
    return {
      id: "journal-1",
      userId: input.userId,
      entryDate: input.entryDate,
      title: input.title ?? null,
      body: input.body,
      tags: input.tags ?? [],
      relatedWeekStart: input.relatedWeekStart ?? null,
      relatedWeeklyReviewId: input.relatedWeeklyReviewId ?? null,
      relatedCardioSessionId: input.relatedCardioSessionId ?? null,
      relatedStrengthSessionId: input.relatedStrengthSessionId ?? null,
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
      deletedAt: null,
    };
  }

  async update(): Promise<JournalEntry> {
    throw new Error("not used in this test");
  }

  async archive(): Promise<void> {}

  async findById(): Promise<JournalEntry | null> {
    return null;
  }

  async listByDateRange(): Promise<JournalEntry[]> {
    return this.existingEntries;
  }
}

class EmptyBodyMetricRepository implements BodyMetricRepository {
  async create(): Promise<BodyMetric> {
    throw new Error("not used");
  }
  async upsertImported(): Promise<BodyMetric> {
    throw new Error("not used");
  }
  async update(): Promise<BodyMetric> {
    throw new Error("not used");
  }
  async archive(): Promise<void> {}
  async findById(): Promise<BodyMetric | null> {
    return null;
  }
  async listByDateRange(): Promise<BodyMetric[]> {
    return [];
  }
}

class EmptyCardioSessionRepository implements CardioSessionRepository {
  async create(): Promise<CardioSession> {
    throw new Error("not used");
  }
  async update(): Promise<CardioSession> {
    throw new Error("not used");
  }
  async archive(): Promise<void> {}
  async findById(): Promise<CardioSession | null> {
    return null;
  }
  async findByExternalId(): Promise<CardioSession | null> {
    return null;
  }
  async listByDateRange(): Promise<CardioSession[]> {
    return [];
  }
}

class EmptyRecoveryCheckinRepository implements RecoveryCheckinRepository {
  async create(): Promise<RecoveryCheckin> {
    throw new Error("not used");
  }
  async update(): Promise<RecoveryCheckin> {
    throw new Error("not used");
  }
  async archive(): Promise<void> {}
  async findById(): Promise<RecoveryCheckin | null> {
    return null;
  }
  async findByDate(): Promise<RecoveryCheckin | null> {
    return null;
  }
  async listByDateRange(): Promise<RecoveryCheckin[]> {
    return [];
  }
}

class FakeStrengthSessionSummaryRepository implements StrengthSessionSummaryRepository {
  constructor(private readonly count: number = 2) {}

  async countCompletedByDateRange(): Promise<number> {
    return this.count;
  }
}

function buildDeps(overrides?: {
  weeklyReviewRepo?: FakeWeeklyReviewRepository;
  journalRepo?: FakeJournalEntryRepository;
  aiWeeklyReviewService?: AiWeeklyReviewService | null;
}) {
  const weeklyReviewRepo =
    overrides?.weeklyReviewRepo ?? new FakeWeeklyReviewRepository();
  const journalRepo =
    overrides?.journalRepo ?? new FakeJournalEntryRepository();

  return {
    weeklyReviewRepo,
    journalRepo,
    deps: {
      weeklyReviewService: new WeeklyReviewService(weeklyReviewRepo),
      journalService: new JournalEntryService(journalRepo),
      bodyMetricService: new BodyMetricService(new EmptyBodyMetricRepository()),
      cardioService: new CardioSessionService(
        new EmptyCardioSessionRepository(),
      ),
      recoveryService: new RecoveryCheckinService(
        new EmptyRecoveryCheckinRepository(),
      ),
      strengthSummaryService: new StrengthSessionSummaryService(
        new FakeStrengthSessionSummaryRepository(2),
      ),
      aiWeeklyReviewService: overrides?.aiWeeklyReviewService ?? null,
    },
  };
}

describe("WeeklyReviewAutoFinalizeService", () => {
  it("drafts a new review and a journal entry when none exists yet, with no AI service configured", async () => {
    const { deps, weeklyReviewRepo, journalRepo } = buildDeps();
    const service = new WeeklyReviewAutoFinalizeService(deps);

    const result = await service.finalizeForUser({ userId, weekStartsOn: 1 });

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.journalDrafted).toBe(true);
      expect(result.aiDrafted).toBe(false);
    }
    expect(weeklyReviewRepo.created).toHaveLength(1);
    expect(journalRepo.created).toHaveLength(1);
  });

  it("skips drafting when a review already exists for the week", async () => {
    const weeklyReviewRepo = new FakeWeeklyReviewRepository();
    weeklyReviewRepo.existing = makeReview();
    const { deps, journalRepo } = buildDeps({ weeklyReviewRepo });
    const service = new WeeklyReviewAutoFinalizeService(deps);

    const result = await service.finalizeForUser({ userId, weekStartsOn: 1 });

    expect(result.status).toBe("skipped");
    expect(journalRepo.created).toHaveLength(0);
  });

  it("does not create a duplicate journal entry when one already exists for the week", async () => {
    const journalRepo = new FakeJournalEntryRepository();
    // draftJournalEntryForUser titles entries "Week of <Mon DD>" — match the
    // getLastCompletedWeekStart() output for "today" mocked deterministically
    // isn't needed here: we only assert create() is skipped when title matches.
    const { deps } = buildDeps({ journalRepo });
    // Prime the existing entries list to include whatever title will be computed.
    // Since the title depends on getLastCompletedWeekStart(new Date()), run once
    // to discover it, then rerun with that title pre-seeded.
    const probe = new WeeklyReviewAutoFinalizeService(deps).finalizeForUser({
      userId,
      weekStartsOn: 1,
    });
    await probe;
    const createdTitle = (
      journalRepo.created[0] as { title: string } | undefined
    )?.title;
    expect(createdTitle).toBeTruthy();

    const secondJournalRepo = new FakeJournalEntryRepository();
    secondJournalRepo.existingEntries = [
      {
        id: "existing-journal",
        userId,
        entryDate: "2026-07-06",
        title: createdTitle ?? null,
        body: "already drafted",
        tags: ["weekly-reflection"],
        relatedWeekStart: "2026-07-06",
        relatedWeeklyReviewId: null,
        relatedCardioSessionId: null,
        relatedStrengthSessionId: null,
        createdAt: "2026-07-13T00:00:00.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z",
        deletedAt: null,
      },
    ];
    const { deps: secondDeps } = buildDeps({ journalRepo: secondJournalRepo });
    const service = new WeeklyReviewAutoFinalizeService(secondDeps);

    const result = await service.finalizeForUser({ userId, weekStartsOn: 1 });

    expect(result.status).toBe("drafted");
    // create() was never called again because the title already matched.
    expect(secondJournalRepo.created).toHaveLength(0);
  });

  it("generates and saves an AI draft when the ai service returns a draft for a fresh 'none' status review", async () => {
    const aiDraft: WeeklyReviewAiDraft = {
      score: 80,
      scoreRationale: "Solid week.",
      whatWorked: "Consistent lifts.",
      whatNeedsAttention: "Zone 2 minutes low.",
      strategicDecision: "Add one more ride.",
      riskForecast: "Low risk.",
      nextBestAction: "Schedule the ride.",
      model: "claude-haiku-4-5-20251001",
      generatedAt: "2026-07-13T00:00:00.000Z",
    };
    const aiWeeklyReviewService: AiWeeklyReviewService = {
      generateDraft: vi.fn().mockResolvedValue(aiDraft),
    } as unknown as AiWeeklyReviewService;

    const { deps, weeklyReviewRepo } = buildDeps({ aiWeeklyReviewService });
    const service = new WeeklyReviewAutoFinalizeService(deps);

    const result = await service.finalizeForUser({ userId, weekStartsOn: 1 });

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.aiDrafted).toBe(true);
    }
    expect(aiWeeklyReviewService.generateDraft).toHaveBeenCalledTimes(1);
    expect(weeklyReviewRepo.updated.at(-1)?.aiDraftStatus).toBe(
      "pending_review",
    );
  });

  it("fails soft (aiDrafted: false) when the AI service throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const aiWeeklyReviewService: AiWeeklyReviewService = {
      generateDraft: vi.fn().mockRejectedValue(new Error("network down")),
    } as unknown as AiWeeklyReviewService;

    const { deps } = buildDeps({ aiWeeklyReviewService });
    const service = new WeeklyReviewAutoFinalizeService(deps);

    const result = await service.finalizeForUser({ userId, weekStartsOn: 1 });

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.aiDrafted).toBe(false);
    }
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does not attempt an AI draft for a skipped (already-existing) review whose aiDraftStatus isn't 'none'", async () => {
    const weeklyReviewRepo = new FakeWeeklyReviewRepository();
    weeklyReviewRepo.existing = makeReview({ aiDraftStatus: "accepted" });
    const aiWeeklyReviewService: AiWeeklyReviewService = {
      generateDraft: vi.fn().mockResolvedValue(null),
    } as unknown as AiWeeklyReviewService;

    const { deps } = buildDeps({ weeklyReviewRepo, aiWeeklyReviewService });
    const service = new WeeklyReviewAutoFinalizeService(deps);

    const result = await service.finalizeForUser({ userId, weekStartsOn: 1 });

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.aiDrafted).toBe(false);
    }
    expect(aiWeeklyReviewService.generateDraft).not.toHaveBeenCalled();
  });
});
