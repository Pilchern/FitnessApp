import type { StrengthExerciseSet, StrengthSession } from "@fitness-app/domain";

export type PRResult = {
  exerciseName: string;
  prType: "weight" | "volume";
  newValue: number;
  previousBest: number | null;
};

function isWeightedSet(set: Pick<StrengthExerciseSet, "weight">) {
  return set.weight != null && set.weight > 0;
}

function setVolumeOrNull(set: Pick<StrengthExerciseSet, "weight" | "reps">) {
  return isWeightedSet(set) && set.reps != null && set.reps > 0
    ? (set.weight as number) * set.reps
    : null;
}

/**
 * Weight and volume PRs against earlier working sets. A first session of an
 * exercise has nothing to beat, so it yields no PR; bodyweight (weight 0 or
 * blank) and zero-volume sets are ignored on both sides.
 */
export function detectPersonalRecords(
  exerciseName: string,
  newSets: Pick<StrengthExerciseSet, "weight" | "reps">[],
  historicalSets: Pick<StrengthExerciseSet, "weight" | "reps">[],
): PRResult[] {
  const results: PRResult[] = [];

  const historicalWeights = historicalSets
    .filter(isWeightedSet)
    .map((s) => s.weight as number);
  const historicalVolumes = historicalSets
    .map(setVolumeOrNull)
    .filter((v): v is number => v != null);

  if (historicalWeights.length > 0) {
    const historicalMaxWeight = Math.max(...historicalWeights);
    const bestWeight = Math.max(
      0,
      ...newSets.filter(isWeightedSet).map((s) => s.weight as number),
    );
    if (bestWeight > historicalMaxWeight) {
      results.push({
        exerciseName,
        prType: "weight",
        newValue: bestWeight,
        previousBest: historicalMaxWeight,
      });
    }
  }

  if (historicalVolumes.length > 0) {
    const historicalMaxVolume = Math.max(...historicalVolumes);
    const bestVolume = Math.max(
      0,
      ...newSets.map(setVolumeOrNull).filter((v): v is number => v != null),
    );
    if (bestVolume > historicalMaxVolume) {
      results.push({
        exerciseName,
        prType: "volume",
        newValue: bestVolume,
        previousBest: historicalMaxVolume,
      });
    }
  }

  return results;
}

export type VolumeTrendPoint = {
  sessionDate: string;
  totalVolume: number;
};

export type TopSetPoint = {
  sessionDate: string;
  weight: number | null;
  reps: number | null;
  /** Seconds, for timed sets (hangs, planks, carries). */
  durationSeconds?: number | null;
  /** Epley estimate; null unless the set has both a load and reps. */
  estimatedOneRepMax: number | null;
};

export type StallDetectionResult = {
  stalled: boolean;
  stagnantSessions: number;
  explanation: string;
};

/**
 * How an exercise is tracked. Only loaded lifts get a trend, stall or PR:
 * bodyweight reps and timed holds are usually held constant on purpose, so a
 * flat line there is the plan, not a stall.
 */
export type ExerciseTrackingKind = "weighted" | "bodyweight" | "timed";

export type StrengthProgressionSummary = {
  exerciseName: string;
  kind: ExerciseTrackingKind;
  /** Distinct session dates with working sets for this exercise. */
  sessionCount: number;
  latestTopSet: TopSetPoint | null;
  previousTopSet: TopSetPoint | null;
  topSetTrend: "up" | "flat" | "down" | "new";
  topSetHistory: TopSetPoint[];
  latestVolume: number | null;
  previousVolume: number | null;
  volumeTrend: "up" | "flat" | "down" | "insufficient_data";
  volumeHistory: VolumeTrendPoint[];
  stall: StallDetectionResult;
  isPersonalRecord: boolean;
};

/** Sessions of an exercise needed before any trend, stall or PR is shown. */
export const MIN_SESSIONS_FOR_TREND = 3;

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Epley-style estimated-1RM formulas become unreliable well past ~12 reps — the
 * multiplier grows without bound, so a lighter-weight, very-high-rep set (e.g. an
 * AMRAP or bodyweight-style set logged with a token weight) can out-score a
 * genuine heavy top set and get flagged as a false personal record. Capping the
 * rep count used in the formula (not the logged rep count itself, which is left
 * untouched everywhere else, e.g. volume math) keeps the estimate from diverging.
 */
const MAX_REPS_FOR_ONE_REP_MAX_ESTIMATE = 12;

type ScoredSet = Pick<StrengthExerciseSet, "weight" | "reps"> & {
  durationSeconds?: number | null;
};

function estimateOneRepMax(set: ScoredSet) {
  if (
    set.weight != null &&
    set.weight > 0 &&
    set.reps != null &&
    set.reps > 0
  ) {
    const cappedReps = Math.min(set.reps, MAX_REPS_FOR_ONE_REP_MAX_ESTIMATE);
    return roundOneDecimal(set.weight * (1 + cappedReps / 30));
  }
  return null;
}

function setScore(set: ScoredSet) {
  const estimate = estimateOneRepMax(set);
  if (estimate != null) return estimate;
  if (set.weight != null && set.weight > 0) return set.weight;
  if (set.reps != null && set.reps > 0) return set.reps;
  if (set.durationSeconds != null && set.durationSeconds > 0) {
    return set.durationSeconds;
  }
  return null;
}

/** The single number a top set is compared on: est. 1RM, else load, reps or seconds. */
export function topSetScore(point: TopSetPoint) {
  return point.estimatedOneRepMax ?? setScore(point) ?? 0;
}

/**
 * How much a top set must move before it counts as a real change rather than
 * rounding or day-to-day noise: 1.5% of the reference, at least 2.5 lb (the
 * smallest plate jump).
 */
function meaningfulDelta(reference: number) {
  return Math.max(2.5, Math.abs(reference) * 0.015);
}

/** Session volume must move more than this share to count as up or down. */
const VOLUME_MEANINGFUL_SHARE = 0.05;

function compareSetPerformance(
  left: TopSetPoint | null,
  right: TopSetPoint | null,
) {
  if (!left || !right) {
    return "new" as const;
  }

  const rightScore = topSetScore(right);
  const difference = topSetScore(left) - rightScore;
  const threshold = meaningfulDelta(rightScore);

  if (difference > threshold) {
    return "up" as const;
  }

  if (difference < -threshold) {
    return "down" as const;
  }

  return "flat" as const;
}

/** Exercise names match case- and whitespace-insensitively. */
function exerciseKey(name: string) {
  return name.trim().toLowerCase();
}

function groupSetsByExerciseAndDate(sessions: StrengthSession[]) {
  const groups = new Map<string, Map<string, StrengthExerciseSet[]>>();

  sessions.forEach((session) => {
    session.sets
      .filter((set) => !set.isWarmup)
      .forEach((set) => {
        const key = exerciseKey(set.exerciseName);
        const exerciseGroups =
          groups.get(key) ?? new Map<string, StrengthExerciseSet[]>();
        const sets = exerciseGroups.get(session.sessionDate) ?? [];
        sets.push(set);
        exerciseGroups.set(session.sessionDate, sets);
        groups.set(key, exerciseGroups);
      });
  });

  return groups;
}

export function buildVolumeTrend(
  sessions: StrengthSession[],
  exerciseName: string,
): VolumeTrendPoint[] {
  const grouped =
    groupSetsByExerciseAndDate(sessions).get(exerciseKey(exerciseName)) ??
    new Map();

  return [...grouped.entries()]
    .map(([sessionDate, sets]) => ({
      sessionDate,
      totalVolume: roundOneDecimal(
        sets.reduce(
          (sum: number, set: StrengthExerciseSet) =>
            sum +
            (set.weight != null && set.reps != null
              ? set.weight * set.reps
              : 0),
          0,
        ),
      ),
    }))
    .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));
}

export function buildTopSetProgression(
  sessions: StrengthSession[],
  exerciseName: string,
): TopSetPoint[] {
  const grouped =
    groupSetsByExerciseAndDate(sessions).get(exerciseKey(exerciseName)) ??
    new Map();

  return [...grouped.entries()]
    .map(([sessionDate, sets]) => {
      const topSet = [...sets].sort((left, right) => {
        const rightScore = setScore(right) ?? -1;
        const leftScore = setScore(left) ?? -1;
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        return right.setNumber - left.setNumber;
      })[0];

      return {
        sessionDate,
        weight: topSet?.weight ?? null,
        reps: topSet?.reps ?? null,
        durationSeconds: topSet?.durationSeconds ?? null,
        estimatedOneRepMax: topSet ? estimateOneRepMax(topSet) : null,
      };
    })
    .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));
}

export function detectRepeatedStall(
  topSets: TopSetPoint[],
): StallDetectionResult {
  if (topSets.length < MIN_SESSIONS_FOR_TREND) {
    return {
      stalled: false,
      stagnantSessions: topSets.length,
      explanation: "Need at least 3 sessions to judge a trend.",
    };
  }

  const recent = topSets.slice(-MIN_SESSIONS_FOR_TREND);
  const baseline = topSetScore(recent[0]);
  // Compare where the lifter is NOW against where the window started, not the
  // window's peak. Using the peak (which included the baseline itself, so it
  // was always >= baseline) meant a mid-window spike masked a subsequent
  // regression: 200 -> 205 -> 180 reported "still show measurable
  // improvement" even though the latest top set was 20 below the baseline.
  const latest = topSetScore(recent[recent.length - 1]);
  const delta = latest - baseline;
  const threshold = meaningfulDelta(baseline);

  if (delta > threshold) {
    return {
      stalled: false,
      stagnantSessions: 0,
      explanation: "Top set is up over the last 3 sessions.",
    };
  }

  // Not progressing either way, but a decline and a plateau are different
  // things to tell someone, so don't describe a decline as "not improved".
  if (delta < -threshold) {
    return {
      stalled: true,
      stagnantSessions: recent.length,
      explanation:
        "Top set trended down over the last 3 sessions. Check recovery or the load jump.",
    };
  }

  return {
    stalled: true,
    stagnantSessions: recent.length,
    explanation: "Top set has not improved meaningfully in 3 sessions.",
  };
}

function trackingKind(sets: StrengthExerciseSet[]): ExerciseTrackingKind {
  if (sets.some((set) => set.weight != null && set.weight > 0)) {
    // A loaded carry is still a timed set; reps are what make it a lift.
    const hasReps = sets.some((set) => set.reps != null && set.reps > 0);
    if (hasReps) return "weighted";
  }
  const timed = sets.some(
    (set) =>
      set.durationSeconds != null &&
      set.durationSeconds > 0 &&
      (set.reps == null || set.reps === 0),
  );
  return timed ? "timed" : "bodyweight";
}

export function buildStrengthProgressionSummaries(
  sessions: StrengthSession[],
): StrengthProgressionSummary[] {
  const grouped = groupSetsByExerciseAndDate(sessions);
  // Display the most recent spelling of each exercise name.
  const displayNames = new Map<string, string>();
  [...sessions]
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .forEach((session) =>
      session.sets.forEach((set) => {
        if (!set.isWarmup) {
          displayNames.set(exerciseKey(set.exerciseName), set.exerciseName);
        }
      }),
    );

  return [...grouped.entries()]
    .map(([key, byDate]) => {
      const exerciseName = displayNames.get(key) ?? key;
      const kind = trackingKind([...byDate.values()].flat());
      const topSets = buildTopSetProgression(sessions, key);
      const volumeTrend = buildVolumeTrend(sessions, key);
      const latestTopSet = topSets[topSets.length - 1] ?? null;
      const previousTopSet = topSets[topSets.length - 2] ?? null;
      const latestVolume =
        volumeTrend[volumeTrend.length - 1]?.totalVolume ?? null;
      const previousVolume =
        volumeTrend[volumeTrend.length - 2]?.totalVolume ?? null;
      const enoughHistory = topSets.length >= MIN_SESSIONS_FOR_TREND;
      const tracksLoad = kind === "weighted" && enoughHistory;

      let volumeTrendLabel: StrengthProgressionSummary["volumeTrend"] =
        "insufficient_data";
      if (tracksLoad && latestVolume != null && previousVolume != null) {
        const threshold = Math.max(1, previousVolume * VOLUME_MEANINGFUL_SHARE);
        if (latestVolume > previousVolume + threshold) {
          volumeTrendLabel = "up";
        } else if (latestVolume < previousVolume - threshold) {
          volumeTrendLabel = "down";
        } else {
          volumeTrendLabel = "flat";
        }
      }

      const topSetTrend = tracksLoad
        ? compareSetPerformance(latestTopSet, previousTopSet)
        : "new";

      // Personal record: latest top set is the all-time best and a real step
      // up from the session before.
      const allTimeMax = Math.max(0, ...topSets.map(topSetScore));
      const isPersonalRecord =
        tracksLoad &&
        latestTopSet != null &&
        topSetScore(latestTopSet) >= allTimeMax &&
        topSetTrend === "up";

      const stall: StallDetectionResult =
        kind === "weighted"
          ? detectRepeatedStall(topSets)
          : {
              stalled: false,
              stagnantSessions: 0,
              explanation:
                kind === "timed"
                  ? "Timed sets: no load trend tracked."
                  : "Bodyweight sets: no load trend tracked.",
            };

      return {
        exerciseName,
        kind,
        sessionCount: topSets.length,
        latestTopSet,
        previousTopSet,
        topSetTrend,
        topSetHistory: topSets,
        latestVolume,
        previousVolume,
        volumeTrend: volumeTrendLabel,
        volumeHistory: volumeTrend,
        stall,
        isPersonalRecord,
      };
    })
    .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName));
}
