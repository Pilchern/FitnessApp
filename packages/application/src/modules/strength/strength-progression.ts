import type { StrengthExerciseSet, StrengthSession } from "@fitness-app/domain";

export type VolumeTrendPoint = {
  sessionDate: string;
  totalVolume: number;
};

export type TopSetPoint = {
  sessionDate: string;
  weight: number | null;
  reps: number | null;
  estimatedOneRepMax: number | null;
};

export type StallDetectionResult = {
  stalled: boolean;
  stagnantSessions: number;
  explanation: string;
};

export type StrengthProgressionSummary = {
  exerciseName: string;
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

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function setScore(set: Pick<StrengthExerciseSet, "weight" | "reps">) {
  if (set.weight != null && set.reps != null) {
    return roundOneDecimal(set.weight * (1 + set.reps / 30));
  }

  if (set.weight != null) {
    return set.weight;
  }

  if (set.reps != null) {
    return set.reps;
  }

  return null;
}

function compareSetPerformance(left: TopSetPoint | null, right: TopSetPoint | null) {
  if (!left || !right) {
    return "new" as const;
  }

  const leftScore = left.estimatedOneRepMax ?? left.weight ?? left.reps ?? 0;
  const rightScore = right.estimatedOneRepMax ?? right.weight ?? right.reps ?? 0;
  const difference = roundOneDecimal(leftScore - rightScore);

  if (difference > 0.5) {
    return "up" as const;
  }

  if (difference < -0.5) {
    return "down" as const;
  }

  return "flat" as const;
}

function groupSetsByExerciseAndDate(sessions: StrengthSession[]) {
  const groups = new Map<string, Map<string, StrengthExerciseSet[]>>();

  sessions.forEach((session) => {
    session.sets.forEach((set) => {
      const exerciseGroups = groups.get(set.exerciseName) ?? new Map<string, StrengthExerciseSet[]>();
      const sets = exerciseGroups.get(session.sessionDate) ?? [];
      sets.push(set);
      exerciseGroups.set(session.sessionDate, sets);
      groups.set(set.exerciseName, exerciseGroups);
    });
  });

  return groups;
}

export function buildVolumeTrend(
  sessions: StrengthSession[],
  exerciseName: string,
): VolumeTrendPoint[] {
  const grouped = groupSetsByExerciseAndDate(sessions).get(exerciseName) ?? new Map();

  return [...grouped.entries()]
    .map(([sessionDate, sets]) => ({
      sessionDate,
      totalVolume: roundOneDecimal(
        sets.reduce(
          (sum: number, set: StrengthExerciseSet) =>
            sum + (set.weight != null && set.reps != null ? set.weight * set.reps : 0),
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
  const grouped = groupSetsByExerciseAndDate(sessions).get(exerciseName) ?? new Map();

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
        estimatedOneRepMax: topSet ? setScore(topSet) : null,
      };
    })
    .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));
}

export function detectRepeatedStall(topSets: TopSetPoint[]): StallDetectionResult {
  if (topSets.length < 3) {
    return {
      stalled: false,
      stagnantSessions: topSets.length,
      explanation: "Need at least 3 sessions to evaluate a stall.",
    };
  }

  const recent = topSets.slice(-3);
  const baseline = recent[0].estimatedOneRepMax ?? recent[0].weight ?? recent[0].reps ?? 0;
  const bestRecent = Math.max(
    ...recent.map((set) => set.estimatedOneRepMax ?? set.weight ?? set.reps ?? 0),
  );

  if (bestRecent - baseline > 0.5) {
    return {
      stalled: false,
      stagnantSessions: 0,
      explanation: "Recent top sets still show measurable improvement.",
    };
  }

  return {
    stalled: true,
    stagnantSessions: recent.length,
    explanation:
      "The last 3 top sets have not improved meaningfully, which is a simple stall signal.",
  };
}

export function buildStrengthProgressionSummaries(
  sessions: StrengthSession[],
): StrengthProgressionSummary[] {
  const exerciseNames = new Set(
    sessions.flatMap((session) => session.sets.map((set) => set.exerciseName)),
  );

  return [...exerciseNames]
    .map((exerciseName) => {
      const topSets = buildTopSetProgression(sessions, exerciseName);
      const volumeTrend = buildVolumeTrend(sessions, exerciseName);
      const latestTopSet = topSets[topSets.length - 1] ?? null;
      const previousTopSet = topSets[topSets.length - 2] ?? null;
      const latestVolume = volumeTrend[volumeTrend.length - 1]?.totalVolume ?? null;
      const previousVolume = volumeTrend[volumeTrend.length - 2]?.totalVolume ?? null;

      let volumeTrendLabel: StrengthProgressionSummary["volumeTrend"] =
        "insufficient_data";
      if (latestVolume != null && previousVolume != null) {
        if (latestVolume > previousVolume + 1) {
          volumeTrendLabel = "up";
        } else if (latestVolume < previousVolume - 1) {
          volumeTrendLabel = "down";
        } else {
          volumeTrendLabel = "flat";
        }
      }

      // Personal record: latest top set is the all-time best for this exercise
      const latestScore =
        latestTopSet?.estimatedOneRepMax ?? latestTopSet?.weight ?? latestTopSet?.reps ?? null;
      const allTimeMax =
        topSets.length > 0
          ? Math.max(
              ...topSets.map(
                (s) => s.estimatedOneRepMax ?? s.weight ?? s.reps ?? 0,
              ),
            )
          : null;
      const isPersonalRecord =
        latestScore != null &&
        allTimeMax != null &&
        topSets.length >= 2 &&
        latestScore >= allTimeMax &&
        compareSetPerformance(latestTopSet, previousTopSet) === "up";

      return {
        exerciseName,
        latestTopSet,
        previousTopSet,
        topSetTrend: compareSetPerformance(latestTopSet, previousTopSet),
        topSetHistory: topSets,
        latestVolume,
        previousVolume,
        volumeTrend: volumeTrendLabel,
        volumeHistory: volumeTrend,
        stall: detectRepeatedStall(topSets),
        isPersonalRecord,
      };
    })
    .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName));
}
