import { describe, expect, it } from "vitest";
import {
  BODY_METRIC_SOURCE_PRIORITY,
  CARDIO_SOURCE_PRIORITY,
  decideBodyMetricCrossProvider,
  decideCardioCrossProvider,
  isSameBodyMetricEvent,
  isSameCardioEvent,
  normalizeWeightLb,
  resolveSourcePriority,
} from "./cross-provider-dedup";
import type {
  BodyMetricDedupShape,
  CardioDedupShape,
} from "./cross-provider-dedup";

const manualSource = { sourceType: "manual" as const, sourceProvider: null };

function imported(provider: string) {
  return { sourceType: "imported" as const, sourceProvider: provider };
}

function cardio(overrides: Partial<CardioDedupShape> = {}): CardioDedupShape {
  return {
    sessionDate: "2026-08-10",
    startedAt: "2026-08-10T14:00:00.000Z",
    durationMinutes: 45,
    source: imported("strava"),
    ...overrides,
  };
}

function metric(
  overrides: Partial<BodyMetricDedupShape> = {},
): BodyMetricDedupShape {
  return {
    measuredOn: "2026-08-10",
    weightLb: 182.4,
    weightKg: null,
    source: imported("withings"),
    ...overrides,
  };
}

describe("resolveSourcePriority", () => {
  it("ranks manual entries above every provider", () => {
    expect(resolveSourcePriority(manualSource, CARDIO_SOURCE_PRIORITY)).toBe(
      100,
    );
    expect(
      resolveSourcePriority(imported("peloton"), CARDIO_SOURCE_PRIORITY),
    ).toBeLessThan(resolveSourcePriority(manualSource, CARDIO_SOURCE_PRIORITY));
  });

  it("ranks a direct provider above a relay for cardio", () => {
    const peloton = resolveSourcePriority(
      imported("peloton"),
      CARDIO_SOURCE_PRIORITY,
    );
    const strava = resolveSourcePriority(
      imported("strava"),
      CARDIO_SOURCE_PRIORITY,
    );
    const appleHealth = resolveSourcePriority(
      imported("apple_health"),
      CARDIO_SOURCE_PRIORITY,
    );

    expect(peloton).toBeGreaterThan(strava);
    expect(strava).toBeGreaterThan(appleHealth);
  });

  it("ranks the scale above a relay for body metrics", () => {
    expect(
      resolveSourcePriority(imported("withings"), BODY_METRIC_SOURCE_PRIORITY),
    ).toBeGreaterThan(
      resolveSourcePriority(
        imported("apple_health"),
        BODY_METRIC_SOURCE_PRIORITY,
      ),
    );
  });

  it("puts an unrecognized provider below every known one", () => {
    const unknown = resolveSourcePriority(
      imported("some_future_provider"),
      CARDIO_SOURCE_PRIORITY,
    );

    expect(unknown).toBeLessThan(
      resolveSourcePriority(imported("apple_health"), CARDIO_SOURCE_PRIORITY),
    );
  });
});

describe("isSameCardioEvent", () => {
  it("matches the same ride arriving from two providers", () => {
    const viaStrava = cardio({ source: imported("strava") });
    const viaAppleHealth = cardio({
      source: imported("apple_health"),
      startedAt: "2026-08-10T14:02:00.000Z",
      durationMinutes: 46,
    });

    expect(isSameCardioEvent(viaAppleHealth, viaStrava)).toBe(true);
  });

  it("keeps two back-to-back rides on the same day distinct", () => {
    const morning = cardio({
      source: imported("strava"),
      startedAt: "2026-08-10T14:00:00.000Z",
    });
    const afternoon = cardio({
      source: imported("apple_health"),
      startedAt: "2026-08-10T18:00:00.000Z",
    });

    expect(isSameCardioEvent(afternoon, morning)).toBe(false);
  });

  it("keeps sessions with clearly different durations distinct", () => {
    const short = cardio({
      source: imported("strava"),
      startedAt: null,
      durationMinutes: 20,
    });
    const long = cardio({
      source: imported("apple_health"),
      startedAt: null,
      durationMinutes: 75,
    });

    expect(isSameCardioEvent(long, short)).toBe(false);
  });

  it("abstains when there is no comparable signal beyond the date", () => {
    // A bare date match is not evidence. Skipping here would silently drop a
    // real workout, which is worse than leaving a duplicate the user can see
    // and delete.
    const noSignal = cardio({ startedAt: null, durationMinutes: null });

    expect(
      isSameCardioEvent(
        { ...noSignal, source: imported("apple_health") },
        { ...noSignal, source: imported("strava") },
      ),
    ).toBe(false);
  });

  it("ignores same-provider pairs, which the unique index already covers", () => {
    expect(
      isSameCardioEvent(
        cardio({ source: imported("strava") }),
        cardio({ source: imported("strava") }),
      ),
    ).toBe(false);
  });

  it("does not match across different days", () => {
    expect(
      isSameCardioEvent(
        cardio({ sessionDate: "2026-08-11", source: imported("apple_health") }),
        cardio({ sessionDate: "2026-08-10", source: imported("strava") }),
      ),
    ).toBe(false);
  });

  it("matches an import against a manual entry for the same workout", () => {
    expect(
      isSameCardioEvent(
        cardio({ source: imported("apple_health") }),
        cardio({ source: manualSource }),
      ),
    ).toBe(true);
  });

  it("rejects the match when start times agree but durations do not", () => {
    // Both signals are present, so both have to agree — a 45-minute ride and a
    // 3-hour ride starting at the same moment are not the same event.
    expect(
      isSameCardioEvent(
        cardio({ source: imported("apple_health"), durationMinutes: 180 }),
        cardio({ source: imported("strava"), durationMinutes: 45 }),
      ),
    ).toBe(false);
  });
});

describe("isSameBodyMetricEvent", () => {
  it("matches the same weigh-in from two providers", () => {
    expect(
      isSameBodyMetricEvent(
        metric({ source: imported("apple_health"), weightLb: 182.6 }),
        metric({ source: imported("withings"), weightLb: 182.4 }),
      ),
    ).toBe(true);
  });

  it("compares across units", () => {
    expect(
      isSameBodyMetricEvent(
        metric({
          source: imported("apple_health"),
          weightLb: null,
          weightKg: 82.7,
        }),
        metric({ source: imported("withings"), weightLb: 182.3 }),
      ),
    ).toBe(true);
  });

  it("keeps two clearly different same-day weights distinct", () => {
    expect(
      isSameBodyMetricEvent(
        metric({ source: imported("apple_health"), weightLb: 195 }),
        metric({ source: imported("withings"), weightLb: 182.4 }),
      ),
    ).toBe(false);
  });

  it("abstains when either record has no weight to compare", () => {
    // A waist-only or body-fat-only row carries nothing to match on.
    expect(
      isSameBodyMetricEvent(
        metric({
          source: imported("apple_health"),
          weightLb: null,
          weightKg: null,
        }),
        metric({ source: imported("withings") }),
      ),
    ).toBe(false);
  });
});

describe("normalizeWeightLb", () => {
  it("prefers a recorded pound value over converting from kilograms", () => {
    expect(normalizeWeightLb({ weightLb: 180, weightKg: 90 })).toBe(180);
  });

  it("converts from kilograms when pounds are absent", () => {
    expect(normalizeWeightLb({ weightLb: null, weightKg: 100 })).toBeCloseTo(
      220.46,
      1,
    );
  });

  it("returns null when neither unit is recorded", () => {
    expect(normalizeWeightLb({ weightLb: null, weightKg: null })).toBeNull();
  });
});

describe("decideCardioCrossProvider", () => {
  it("inserts when nothing else is stored for the day", () => {
    const decision = decideCardioCrossProvider(cardio(), []);

    expect(decision.outcome).toBe("insert");
    expect(decision.duplicateOf).toBeNull();
  });

  it("skips an Apple Health relay of a ride Strava already imported", () => {
    // The live TD-019 scenario: a Peloton ride reaches Strava via Peloton's
    // auto-export and reaches Apple Health via a bridge app, so the same ride
    // arrives twice under two different external ids.
    const decision = decideCardioCrossProvider(
      cardio({ source: imported("apple_health") }),
      [{ id: "existing-1", ...cardio({ source: imported("strava") }) }],
    );

    expect(decision.outcome).toBe("skip_incoming");
    expect(decision.duplicateOf).toBe("existing-1");
    expect(decision.reason).toContain("strava");
  });

  it("supersedes a lower-fidelity record when a direct provider arrives", () => {
    const decision = decideCardioCrossProvider(
      cardio({ source: imported("peloton") }),
      [{ id: "existing-1", ...cardio({ source: imported("apple_health") }) }],
    );

    expect(decision.outcome).toBe("supersede_existing");
    expect(decision.duplicateOf).toBe("existing-1");
  });

  it("never supersedes a manual entry", () => {
    const decision = decideCardioCrossProvider(
      cardio({ source: imported("peloton") }),
      [{ id: "manual-1", ...cardio({ source: manualSource }) }],
    );

    expect(decision.outcome).toBe("skip_incoming");
    expect(decision.duplicateOf).toBe("manual-1");
  });

  it("compares against the highest-priority match when several are stored", () => {
    // Both stored sessions match the incoming Apple Health workout. The
    // decision must be made against Peloton (the better record), not against
    // whichever row the query happened to return first.
    const decision = decideCardioCrossProvider(
      cardio({ source: imported("apple_health") }),
      [
        { id: "strava-1", ...cardio({ source: imported("strava") }) },
        { id: "peloton-1", ...cardio({ source: imported("peloton") }) },
      ],
    );

    expect(decision.outcome).toBe("skip_incoming");
    expect(decision.duplicateOf).toBe("peloton-1");
  });

  it("inserts when the only same-day session is a different workout", () => {
    const decision = decideCardioCrossProvider(
      cardio({
        source: imported("apple_health"),
        startedAt: "2026-08-10T19:00:00.000Z",
      }),
      [
        {
          id: "existing-1",
          ...cardio({
            source: imported("strava"),
            startedAt: "2026-08-10T06:00:00.000Z",
          }),
        },
      ],
    );

    expect(decision.outcome).toBe("insert");
  });
});

describe("decideBodyMetricCrossProvider", () => {
  it("skips an Apple Health weight the Withings scale already recorded", () => {
    const decision = decideBodyMetricCrossProvider(
      metric({ source: imported("apple_health") }),
      [{ id: "withings-1", ...metric({ source: imported("withings") }) }],
    );

    expect(decision.outcome).toBe("skip_incoming");
    expect(decision.duplicateOf).toBe("withings-1");
  });

  it("supersedes an Apple Health weight when the scale's own reading arrives", () => {
    const decision = decideBodyMetricCrossProvider(
      metric({ source: imported("withings") }),
      [{ id: "apple-1", ...metric({ source: imported("apple_health") }) }],
    );

    expect(decision.outcome).toBe("supersede_existing");
    expect(decision.duplicateOf).toBe("apple-1");
  });

  it("never supersedes a manually logged weigh-in", () => {
    const decision = decideBodyMetricCrossProvider(
      metric({ source: imported("withings") }),
      [{ id: "manual-1", ...metric({ source: manualSource }) }],
    );

    expect(decision.outcome).toBe("skip_incoming");
  });
});
