/**
 * Service-level coverage for TD-019: proves the cross-provider decision is
 * actually wired into the two persistence paths, not just correct in
 * isolation. `cross-provider-dedup.test.ts` covers the decision logic itself.
 */
import { describe, expect, it, vi } from "vitest";
import type { BodyMetric, CardioSession } from "@fitness-app/domain";
import { BodyMetricService } from "../body-metrics/body-metric";
import { CardioSessionService } from "../cardio/cardio-session";

const userId = "11111111-1111-4111-8111-111111111111";

function storedCardio(
  overrides: Partial<CardioSession> & Pick<CardioSession, "id">,
): CardioSession {
  return {
    userId,
    trainingTemplateId: null,
    sessionDate: "2026-08-10",
    startedAt: "2026-08-10T14:00:00.000Z",
    endedAt: null,
    sessionKind: "zone2",
    plannedVsCompleted: "completed",
    durationMinutes: 45,
    zone2Minutes: null,
    avgHeartRate: null,
    maxHeartRate: null,
    avgOutput: null,
    cadenceMin: null,
    cadenceMax: null,
    resistanceMin: null,
    resistanceMax: null,
    intervalStructure: null,
    rpe: null,
    distanceMeters: null,
    notes: null,
    sportType: "Ride",
    source: {
      sourceType: "imported",
      sourceProvider: "strava",
      sourceExternalId: "strava-1",
      importBatchId: null,
      rawImportEventId: null,
    },
    createdAt: "2026-08-10T15:00:00.000Z",
    updatedAt: "2026-08-10T15:00:00.000Z",
    deletedAt: null,
    ...overrides,
  } as CardioSession;
}

function storedMetric(
  overrides: Partial<BodyMetric> & Pick<BodyMetric, "id">,
): BodyMetric {
  return {
    userId,
    measuredOn: "2026-08-10",
    weightLb: 182.4,
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
    source: {
      sourceType: "imported",
      sourceProvider: "withings",
      sourceExternalId: "withings-1",
      importBatchId: null,
      rawImportEventId: null,
    },
    createdAt: "2026-08-10T15:00:00.000Z",
    updatedAt: "2026-08-10T15:00:00.000Z",
    deletedAt: null,
    ...overrides,
  } as BodyMetric;
}

function createCardioRepository(sameDay: CardioSession[]) {
  return {
    create: vi
      .fn()
      .mockImplementation(async () => storedCardio({ id: "created-1" })),
    update: vi.fn(),
    archive: vi.fn(),
    findById: vi.fn(),
    findByExternalId: vi.fn().mockResolvedValue(null),
    findArchivedByExternalId: vi.fn().mockResolvedValue(null),
    listByDateRange: vi.fn().mockResolvedValue(sameDay),
  };
}

function createBodyMetricRepository(sameDay: BodyMetric[]) {
  return {
    create: vi.fn(),
    upsertImported: vi
      .fn()
      .mockImplementation(async () => storedMetric({ id: "created-1" })),
    update: vi.fn(),
    archive: vi.fn(),
    findById: vi.fn(),
    listByDateRange: vi.fn().mockResolvedValue(sameDay),
  };
}

const importedAppleHealthRide = {
  sessionDate: "2026-08-10",
  startedAt: "2026-08-10T14:01:00.000Z",
  durationMinutes: 45,
  sessionKind: "zone2" as const,
  plannedVsCompleted: "completed" as const,
  sportType: "Cycling",
  source: {
    sourceType: "imported" as const,
    sourceProvider: "apple_health",
    sourceExternalId: "ah-1",
    importBatchId: null,
    rawImportEventId: null,
  },
};

describe("CardioSessionService.upsertImported cross-provider handling", () => {
  it("skips a ride the higher-priority provider already imported", async () => {
    const repository = createCardioRepository([
      storedCardio({ id: "strava-1" }),
    ]);
    const service = new CardioSessionService(repository as never);

    const result = await service.upsertImported(
      userId,
      importedAppleHealthRide,
    );

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.archive).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.session.id).toBe("strava-1");
    expect(result.crossProvider?.outcome).toBe("skip_incoming");
  });

  it("archives the lower-priority record when a better one arrives", async () => {
    const repository = createCardioRepository([
      storedCardio({
        id: "apple-1",
        source: {
          sourceType: "imported",
          sourceProvider: "apple_health",
          sourceExternalId: "ah-1",
          importBatchId: null,
          rawImportEventId: null,
        },
      }),
    ]);
    const service = new CardioSessionService(repository as never);

    const result = await service.upsertImported(userId, {
      ...importedAppleHealthRide,
      source: {
        ...importedAppleHealthRide.source,
        sourceProvider: "peloton",
        sourceExternalId: "peloton-1",
      },
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.archive).toHaveBeenCalledWith(userId, "apple-1");
    expect(result.created).toBe(true);
    expect(result.crossProvider?.outcome).toBe("supersede_existing");
  });

  it("inserts normally when the day holds an unrelated workout", async () => {
    const repository = createCardioRepository([
      storedCardio({ id: "strava-1", startedAt: "2026-08-10T06:00:00.000Z" }),
    ]);
    const service = new CardioSessionService(repository as never);

    const result = await service.upsertImported(
      userId,
      importedAppleHealthRide,
    );

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.archive).not.toHaveBeenCalled();
    expect(result.crossProvider?.outcome).toBe("insert");
  });

  it("still short-circuits a same-provider re-import before any dedup query", async () => {
    const repository = createCardioRepository([]);
    repository.findByExternalId.mockResolvedValue(
      storedCardio({ id: "existing-1" }),
    );
    const service = new CardioSessionService(repository as never);

    const result = await service.upsertImported(
      userId,
      importedAppleHealthRide,
    );

    expect(result.created).toBe(false);
    expect(result.session.id).toBe("existing-1");
    expect(repository.listByDateRange).not.toHaveBeenCalled();
  });

  it("widens the duplicate lookup to the adjacent days", async () => {
    const repository = createCardioRepository([]);
    const service = new CardioSessionService(repository as never);

    await service.upsertImported(userId, importedAppleHealthRide);

    expect(repository.listByDateRange).toHaveBeenCalledWith({
      userId,
      startDate: "2026-08-09",
      endDate: "2026-08-11",
    });
  });
  it("returns an archived same-provider row instead of re-creating it", async () => {
    // `cardio_sessions_external_id_dedup_idx` has no `deleted_at is null`
    // predicate, so a tombstone still holds its slot. Falling through to
    // create here would violate that constraint on every sync, forever —
    // and for Apple Health, which re-posts whatever the bridge sends with no
    // cursor, "forever" is literal.
    const repository = createCardioRepository([]);
    repository.findArchivedByExternalId.mockResolvedValue(
      storedCardio({ id: "archived-1" }),
    );
    const service = new CardioSessionService(repository as never);

    const result = await service.upsertImported(
      userId,
      importedAppleHealthRide,
    );

    expect(repository.create).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.session.id).toBe("archived-1");
  });
});

describe("BodyMetricService.upsertImported cross-provider handling", () => {
  const importedAppleHealthWeight = {
    userId,
    measuredOn: "2026-08-10",
    weightLb: 182.5,
    source: {
      sourceType: "imported" as const,
      sourceProvider: "apple_health",
      sourceExternalId: "ah-weight-1",
      importBatchId: null,
      rawImportEventId: null,
    },
  };

  it("skips a weigh-in the scale already recorded", async () => {
    const repository = createBodyMetricRepository([
      storedMetric({ id: "withings-1" }),
    ]);
    const service = new BodyMetricService(repository as never);

    const result = await service.upsertImported(importedAppleHealthWeight);

    expect(repository.upsertImported).not.toHaveBeenCalled();
    expect(result.metric.id).toBe("withings-1");
    expect(result.crossProvider.outcome).toBe("skip_incoming");
  });

  it("archives a relayed weight when the scale's own reading arrives", async () => {
    const repository = createBodyMetricRepository([
      storedMetric({
        id: "apple-1",
        source: {
          sourceType: "imported",
          sourceProvider: "apple_health",
          sourceExternalId: "ah-weight-1",
          importBatchId: null,
          rawImportEventId: null,
        },
      }),
    ]);
    const service = new BodyMetricService(repository as never);

    const result = await service.upsertImported({
      ...importedAppleHealthWeight,
      source: {
        ...importedAppleHealthWeight.source,
        sourceProvider: "withings",
        sourceExternalId: "withings-1",
      },
    });

    expect(repository.upsertImported).toHaveBeenCalledTimes(1);
    expect(repository.archive).toHaveBeenCalledWith(userId, "apple-1");
    expect(result.crossProvider.outcome).toBe("supersede_existing");
  });

  it("inserts normally when the day's stored weight is clearly different", async () => {
    const repository = createBodyMetricRepository([
      storedMetric({ id: "withings-1", weightLb: 205 }),
    ]);
    const service = new BodyMetricService(repository as never);

    const result = await service.upsertImported(importedAppleHealthWeight);

    expect(repository.upsertImported).toHaveBeenCalledTimes(1);
    expect(repository.archive).not.toHaveBeenCalled();
    expect(result.crossProvider.outcome).toBe("insert");
  });

  it("still rejects a manual source", async () => {
    const repository = createBodyMetricRepository([]);
    const service = new BodyMetricService(repository as never);

    await expect(
      service.upsertImported({
        userId,
        measuredOn: "2026-08-10",
        weightLb: 182.5,
      }),
    ).rejects.toThrow("imported source");
  });
  it("does not archive the loser when the repository refused to write (tombstone)", async () => {
    // The repository has tombstone semantics: if this provider's external id
    // was soft-deleted by the user, it returns the tombstone and writes
    // nothing. Archiving the loser anyway left the day with NO live record —
    // both the row we thought we wrote and the one we superseded gone — and
    // repeated on every sync.
    const repository = createBodyMetricRepository([
      storedMetric({
        id: "apple-1",
        source: {
          sourceType: "imported",
          sourceProvider: "apple_health",
          sourceExternalId: "ah-weight-1",
          importBatchId: null,
          rawImportEventId: null,
        },
      }),
    ]);
    repository.upsertImported.mockResolvedValue(
      storedMetric({
        id: "withings-tombstone",
        deletedAt: "2026-08-11T00:00:00.000Z",
      }),
    );
    const service = new BodyMetricService(repository as never);

    const result = await service.upsertImported({
      ...importedAppleHealthWeight,
      source: {
        ...importedAppleHealthWeight.source,
        sourceProvider: "withings",
        sourceExternalId: "withings-1",
      },
    });

    expect(repository.archive).not.toHaveBeenCalled();
    expect(result.crossProvider.outcome).toBe("skip_incoming");
  });
});
