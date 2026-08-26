/**
 * Cross-provider duplicate detection (TD-019).
 *
 * The database's unique indexes on `(user_id, source_provider,
 * source_external_id)` stop the *same* provider re-importing the *same*
 * external id. Nothing stops the *same real-world event* arriving from two
 * *different* providers: one Peloton ride can land once as `peloton` (or via
 * the Strava relay) and again as `apple_health` once a bridge app is syncing
 * workouts, because the two carry different provider ids and so miss each
 * other's unique index entirely.
 *
 * This module is the pure decision layer for that. It answers two questions
 * and nothing else — no I/O, no persistence:
 *
 *   1. Does an incoming imported record describe the same real-world event as
 *      one already stored, from a different source?
 *   2. If so, which of the two should win?
 *
 * Design constraints, in the order they were weighed:
 *
 * - **Never lose a real workout or weigh-in.** Wrongly merging two genuinely
 *   distinct records is worse than leaving a duplicate the user can delete,
 *   so every matcher requires positive evidence of a match and abstains when
 *   the signals it needs are absent. Two same-day records with no comparable
 *   duration and no comparable start time are treated as *distinct*.
 * - **Manual entries always win.** An import must never supersede something
 *   the user typed in by hand.
 * - **Higher-fidelity providers win over relays.** A record from the device
 *   that measured the event carries fields a relay drops (see
 *   `CARDIO_SOURCE_PRIORITY` below).
 */

/** The provider set that can write imported records today. */
export type DedupSourceProvider = string;

/**
 * The subset of a record's `source` this module needs. Both `CardioSession`
 * and `BodyMetric` from `@fitness-app/domain` satisfy this structurally.
 */
export type DedupRecordSource = {
  sourceType: "manual" | "imported" | "mixed";
  sourceProvider: DedupSourceProvider | null;
};

/**
 * Priority for cardio sources, highest wins. Rationale:
 *
 * - `manual` — the user typed it; an import never overrides a person.
 * - `peloton` — direct sync carries `cadenceMax`/`resistanceMin`/
 *   `resistanceMax`, which no other path has.
 * - `strava` — the relay keeps `avgOutput`/`cadenceMin` but drops the rest;
 *   Strava's activity model has no equivalent fields.
 * - `apple_health` — a workout bridge, narrowest of the three: duration,
 *   heart rate, distance.
 */
export const CARDIO_SOURCE_PRIORITY: Record<string, number> = {
  manual: 100,
  peloton: 30,
  strava: 20,
  apple_health: 10,
};

/**
 * Priority for body-metric sources, highest wins. Withings *is* the scale, so
 * it carries body composition (muscle/bone/fat-free mass, hydration, visceral
 * fat) that a relay reduces to a bare weight.
 */
export const BODY_METRIC_SOURCE_PRIORITY: Record<string, number> = {
  manual: 100,
  withings: 30,
  apple_health: 10,
};

/**
 * Priority for a source this module has no explicit entry for. Below every
 * known provider, so an unrecognized new provider never supersedes a known
 * one on priority alone — it can only ever be the record that gets skipped.
 */
export const UNKNOWN_SOURCE_PRIORITY = 1;

/**
 * Two sessions this far apart in start time are treated as separate workouts.
 * Generous enough to absorb a bridge app rounding to the minute or a relay
 * recording the upload time rather than the start, tight enough that two
 * back-to-back rides on the same day stay distinct.
 */
export const CARDIO_START_TIME_TOLERANCE_MINUTES = 20;

/**
 * Two sessions whose durations differ by more than this are treated as
 * separate workouts. Providers disagree by a minute or two on where a workout
 * ends (moving time vs. elapsed time, auto-pause), not by more.
 */
export const CARDIO_DURATION_TOLERANCE_MINUTES = 5;

/**
 * Two same-day weigh-ins further apart than this are treated as separate
 * measurements rather than one measurement seen twice.
 */
export const BODY_METRIC_WEIGHT_TOLERANCE_LB = 2;

const KG_TO_LB = 2.2046226218;
const MS_PER_MINUTE = 60_000;

/** What to do with an incoming imported record. */
export type CrossProviderDecision =
  /** No duplicate found — store it. */
  | { outcome: "insert"; duplicateOf: null; reason: null }
  /**
   * A duplicate exists and outranks the incoming record. Skip the insert; the
   * stored record stays as-is.
   */
  | { outcome: "skip_incoming"; duplicateOf: string; reason: string }
  /**
   * A duplicate exists but the incoming record outranks it. Store the
   * incoming record and archive the stored one (a soft delete — recoverable).
   */
  | { outcome: "supersede_existing"; duplicateOf: string; reason: string };

export function resolveSourcePriority(
  source: DedupRecordSource,
  priorities: Record<string, number>,
): number {
  if (source.sourceType === "manual") {
    return priorities.manual ?? UNKNOWN_SOURCE_PRIORITY;
  }
  if (!source.sourceProvider) {
    return UNKNOWN_SOURCE_PRIORITY;
  }
  return priorities[source.sourceProvider] ?? UNKNOWN_SOURCE_PRIORITY;
}

/**
 * True when the two records come from *different* sources. Same-provider
 * duplicates are already handled by the unique index and by each service's
 * existing `findByExternalId` check, so this module deliberately ignores
 * them — re-deduping them here could skip a legitimate second workout that
 * the provider itself gave a distinct external id.
 */
function isDifferentSource(
  incoming: DedupRecordSource,
  existing: DedupRecordSource,
): boolean {
  if (incoming.sourceType === "manual" && existing.sourceType === "manual") {
    return false;
  }
  if (incoming.sourceType !== existing.sourceType) {
    return true;
  }
  return incoming.sourceProvider !== existing.sourceProvider;
}

function minutesApart(left: string, right: string): number | null {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
    return null;
  }
  return Math.abs(leftMs - rightMs) / MS_PER_MINUTE;
}

export function normalizeWeightLb(record: {
  weightLb: number | null;
  weightKg: number | null;
}): number | null {
  if (record.weightLb != null) {
    return record.weightLb;
  }
  if (record.weightKg != null) {
    return record.weightKg * KG_TO_LB;
  }
  return null;
}

/** The fields of a cardio session this module compares. */
export type CardioDedupShape = {
  sessionDate: string;
  startedAt: string | null;
  durationMinutes: number | null;
  source: DedupRecordSource;
};

/** The fields of a body metric this module compares. */
export type BodyMetricDedupShape = {
  measuredOn: string;
  weightLb: number | null;
  weightKg: number | null;
  source: DedupRecordSource;
};

/**
 * Whether two cardio sessions describe the same real-world workout.
 *
 * Requires the same calendar day, different sources, and *every* signal the
 * two records share to agree. Abstains (returns false) when they share no
 * comparable signal at all — a bare date match is not evidence.
 */
export function isSameCardioEvent(
  incoming: CardioDedupShape,
  existing: CardioDedupShape,
): boolean {
  if (incoming.sessionDate !== existing.sessionDate) {
    return false;
  }
  if (!isDifferentSource(incoming.source, existing.source)) {
    return false;
  }

  let comparedAnySignal = false;

  if (incoming.startedAt && existing.startedAt) {
    const apart = minutesApart(incoming.startedAt, existing.startedAt);
    if (apart != null) {
      if (apart > CARDIO_START_TIME_TOLERANCE_MINUTES) {
        return false;
      }
      comparedAnySignal = true;
    }
  }

  if (incoming.durationMinutes != null && existing.durationMinutes != null) {
    const apart = Math.abs(incoming.durationMinutes - existing.durationMinutes);
    if (apart > CARDIO_DURATION_TOLERANCE_MINUTES) {
      return false;
    }
    comparedAnySignal = true;
  }

  return comparedAnySignal;
}

/**
 * Whether two body metrics describe the same real-world weigh-in.
 *
 * Requires the same calendar day, different sources, and weights within
 * tolerance. Abstains when either record has no weight at all — a waist-only
 * or body-fat-only row carries nothing to match on.
 */
export function isSameBodyMetricEvent(
  incoming: BodyMetricDedupShape,
  existing: BodyMetricDedupShape,
): boolean {
  if (incoming.measuredOn !== existing.measuredOn) {
    return false;
  }
  if (!isDifferentSource(incoming.source, existing.source)) {
    return false;
  }

  const incomingWeight = normalizeWeightLb(incoming);
  const existingWeight = normalizeWeightLb(existing);
  if (incomingWeight == null || existingWeight == null) {
    return false;
  }

  return (
    Math.abs(incomingWeight - existingWeight) <= BODY_METRIC_WEIGHT_TOLERANCE_LB
  );
}

function describeSource(source: DedupRecordSource): string {
  if (source.sourceType === "manual") {
    return "a manual entry";
  }
  return source.sourceProvider ?? "an unknown source";
}

function decide<T extends { id: string; source: DedupRecordSource }>(
  incomingSource: DedupRecordSource,
  duplicate: T | null,
  priorities: Record<string, number>,
  eventLabel: string,
): CrossProviderDecision {
  if (!duplicate) {
    return { outcome: "insert", duplicateOf: null, reason: null };
  }

  const incomingPriority = resolveSourcePriority(incomingSource, priorities);
  const existingPriority = resolveSourcePriority(duplicate.source, priorities);

  if (incomingPriority > existingPriority) {
    return {
      outcome: "supersede_existing",
      duplicateOf: duplicate.id,
      reason:
        `Replaces the same ${eventLabel} already imported from ` +
        `${describeSource(duplicate.source)}, because ` +
        `${describeSource(incomingSource)} records it in more detail.`,
    };
  }

  return {
    outcome: "skip_incoming",
    duplicateOf: duplicate.id,
    reason:
      `Skipped: the same ${eventLabel} is already recorded from ` +
      `${describeSource(duplicate.source)}, which takes precedence over ` +
      `${describeSource(incomingSource)}.`,
  };
}

/**
 * Decide what to do with an incoming cardio session, given every session
 * already stored for that same calendar day.
 *
 * When more than one stored session matches, the highest-priority one is the
 * comparison target — so a lower-priority incoming record is skipped against
 * the best record present, not an arbitrary one.
 */
export function decideCardioCrossProvider<
  T extends CardioDedupShape & { id: string },
>(incoming: CardioDedupShape, sameDayExisting: T[]): CrossProviderDecision {
  const matches = sameDayExisting.filter((existing) =>
    isSameCardioEvent(incoming, existing),
  );
  const best = pickHighestPriority(matches, CARDIO_SOURCE_PRIORITY);
  return decide(incoming.source, best, CARDIO_SOURCE_PRIORITY, "workout");
}

/**
 * Decide what to do with an incoming body metric, given every metric already
 * stored for that same calendar day.
 */
export function decideBodyMetricCrossProvider<
  T extends BodyMetricDedupShape & { id: string },
>(incoming: BodyMetricDedupShape, sameDayExisting: T[]): CrossProviderDecision {
  const matches = sameDayExisting.filter((existing) =>
    isSameBodyMetricEvent(incoming, existing),
  );
  const best = pickHighestPriority(matches, BODY_METRIC_SOURCE_PRIORITY);
  return decide(
    incoming.source,
    best,
    BODY_METRIC_SOURCE_PRIORITY,
    "measurement",
  );
}

function pickHighestPriority<T extends { source: DedupRecordSource }>(
  candidates: T[],
  priorities: Record<string, number>,
): T | null {
  let best: T | null = null;
  let bestPriority = -Infinity;
  for (const candidate of candidates) {
    const priority = resolveSourcePriority(candidate.source, priorities);
    if (priority > bestPriority) {
      best = candidate;
      bestPriority = priority;
    }
  }
  return best;
}
