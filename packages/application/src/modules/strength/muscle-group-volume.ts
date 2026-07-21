import type {
  MovementPattern,
  MuscleGroup,
  StrengthSession,
} from "@fitness-app/domain";
import { resolveExercise } from "./exercise-catalog-data";

export type MuscleGroupVolume = {
  muscleGroup: MuscleGroup;
  workingSetCount: number;
  totalVolume: number;
  lastTrainedDate: string | null;
};

export type MovementPatternVolume = {
  movementPattern: MovementPattern;
  workingSetCount: number;
  totalVolume: number;
};

export type MuscleGroupVolumeSummary = {
  rangeStart: string;
  rangeEnd: string;
  byMuscleGroup: MuscleGroupVolume[];
  byMovementPattern: MovementPatternVolume[];
  /** Muscle groups with zero working sets in range, ordered by catalog definition order. */
  neglectedMuscleGroups: MuscleGroup[];
  /** Push:pull volume ratio — null when there isn't enough data on either side to compare. */
  pushPullVolumeRatio: number | null;
  /** Working sets whose exercise name didn't resolve to a known catalog entry — surfaced for transparency, never silently dropped. */
  unclassifiedWorkingSetCount: number;
};

const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
];

const ALL_MOVEMENT_PATTERNS: MovementPattern[] = [
  "push",
  "pull",
  "legs",
  "core",
];

function setVolume(set: {
  weight: number | null;
  reps: number | null;
}): number {
  return set.weight != null && set.reps != null ? set.weight * set.reps : 0;
}

export function computeMuscleGroupVolume(
  sessions: StrengthSession[],
  range: { startDate: string; endDate: string },
): MuscleGroupVolumeSummary {
  const inRange = sessions.filter(
    (session) =>
      session.sessionDate >= range.startDate &&
      session.sessionDate <= range.endDate,
  );

  const muscleGroupTotals = new Map<
    MuscleGroup,
    {
      workingSetCount: number;
      totalVolume: number;
      lastTrainedDate: string | null;
    }
  >();
  const patternTotals = new Map<
    MovementPattern,
    { workingSetCount: number; totalVolume: number }
  >();
  let unclassifiedWorkingSetCount = 0;

  for (const session of inRange) {
    for (const set of session.sets) {
      if (set.isWarmup) {
        continue;
      }

      const catalogEntry = resolveExercise(set.exerciseName);
      if (!catalogEntry) {
        unclassifiedWorkingSetCount += 1;
        continue;
      }

      const volume = setVolume(set);

      const muscleTotal = muscleGroupTotals.get(catalogEntry.muscleGroup) ?? {
        workingSetCount: 0,
        totalVolume: 0,
        lastTrainedDate: null,
      };
      muscleTotal.workingSetCount += 1;
      muscleTotal.totalVolume += volume;
      if (
        !muscleTotal.lastTrainedDate ||
        session.sessionDate > muscleTotal.lastTrainedDate
      ) {
        muscleTotal.lastTrainedDate = session.sessionDate;
      }
      muscleGroupTotals.set(catalogEntry.muscleGroup, muscleTotal);

      const patternTotal = patternTotals.get(catalogEntry.movementPattern) ?? {
        workingSetCount: 0,
        totalVolume: 0,
      };
      patternTotal.workingSetCount += 1;
      patternTotal.totalVolume += volume;
      patternTotals.set(catalogEntry.movementPattern, patternTotal);
    }
  }

  const byMuscleGroup: MuscleGroupVolume[] = ALL_MUSCLE_GROUPS.map(
    (muscleGroup) => {
      const totals = muscleGroupTotals.get(muscleGroup);
      return {
        muscleGroup,
        workingSetCount: totals?.workingSetCount ?? 0,
        totalVolume: Math.round((totals?.totalVolume ?? 0) * 10) / 10,
        lastTrainedDate: totals?.lastTrainedDate ?? null,
      };
    },
  );

  const byMovementPattern: MovementPatternVolume[] = ALL_MOVEMENT_PATTERNS.map(
    (movementPattern) => {
      const totals = patternTotals.get(movementPattern);
      return {
        movementPattern,
        workingSetCount: totals?.workingSetCount ?? 0,
        totalVolume: Math.round((totals?.totalVolume ?? 0) * 10) / 10,
      };
    },
  );

  const neglectedMuscleGroups = byMuscleGroup
    .filter((group) => group.workingSetCount === 0)
    .map((group) => group.muscleGroup);

  const pushVolume =
    byMovementPattern.find((p) => p.movementPattern === "push")?.totalVolume ??
    0;
  const pullVolume =
    byMovementPattern.find((p) => p.movementPattern === "pull")?.totalVolume ??
    0;
  const pushPullVolumeRatio =
    pushVolume > 0 && pullVolume > 0
      ? Math.round((pushVolume / pullVolume) * 100) / 100
      : null;

  return {
    rangeStart: range.startDate,
    rangeEnd: range.endDate,
    byMuscleGroup,
    byMovementPattern,
    neglectedMuscleGroups,
    pushPullVolumeRatio,
    unclassifiedWorkingSetCount,
  };
}
