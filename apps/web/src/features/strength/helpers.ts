import type { StrengthSession } from "@fitness-app/domain";
import type { StrengthFormValues, StrengthSetFormValue } from "./types";

export function createEmptyStrengthSet(
  partial?: Partial<StrengthSetFormValue>,
): StrengthSetFormValue {
  return {
    exerciseName: partial?.exerciseName ?? "",
    setNumber: partial?.setNumber ?? 1,
    reps: partial?.reps ?? "",
    weight: partial?.weight ?? "",
    rir: partial?.rir ?? "",
    isWarmup: partial?.isWarmup ?? false,
    durationSeconds: partial?.durationSeconds ?? "",
    distanceMeters: partial?.distanceMeters ?? "",
    notes: partial?.notes ?? "",
  };
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numberToInput(value: number | null) {
  return value == null ? "" : `${value}`;
}

export function toStrengthFormValues(
  session: StrengthSession | null,
): StrengthFormValues {
  if (!session) {
    return {
      sessionDate: todayIsoDate(),
      sessionName: "",
      notes: "",
      durationMinutes: "",
      readinessPre: "",
      energyPost: "",
      completedAsPlanned: true,
      sets: [createEmptyStrengthSet()],
    };
  }

  return {
    id: session.id,
    sessionDate: session.sessionDate,
    sessionName: session.sessionName ?? "",
    notes: session.notes ?? "",
    durationMinutes: numberToInput(session.durationMinutes),
    readinessPre: numberToInput(session.readinessPre),
    energyPost: numberToInput(session.energyPost),
    completedAsPlanned: session.completedAsPlanned,
    sets:
      session.sets.length > 0
        ? session.sets.map((set) => ({
            exerciseName: set.exerciseName,
            setNumber: set.setNumber,
            reps: numberToInput(set.reps),
            weight: numberToInput(set.weight),
            rir: numberToInput(set.rir),
            isWarmup: set.isWarmup,
            durationSeconds: numberToInput(set.durationSeconds),
            distanceMeters: numberToInput(set.distanceMeters),
            notes: set.notes ?? "",
          }))
        : [createEmptyStrengthSet()],
  };
}

export function formatStrengthDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatTopSet(weight: number | null, reps: number | null) {
  if (weight == null && reps == null) {
    return "--";
  }

  if (weight != null && reps != null) {
    return `${weight} x ${reps}`;
  }

  if (weight != null) {
    return `${weight} lb`;
  }

  return `${reps} reps`;
}

export type LastExercisePerformance = {
  sessionDate: string;
  /** Working sets only (warm-ups excluded), in set order. */
  sets: { weight: number | null; reps: number | null }[];
};

export function exerciseKey(name: string) {
  return name.trim().toLowerCase();
}

/**
 * For each exercise, the working sets from the most recent session that
 * contains it. Used to show "Last: 165 x 8, 8, 7" next to a loaded plan and to
 * start the weight at what was actually lifted last time instead of a stale
 * template target. Exercises whose only sets are warm-ups are skipped.
 */
export function buildLastByExercise(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
): Record<string, LastExercisePerformance> {
  const newestFirst = [...sessions].sort((a, b) =>
    b.sessionDate.localeCompare(a.sessionDate),
  );
  const result: Record<string, LastExercisePerformance> = {};

  for (const session of newestFirst) {
    const byExercise = new Map<string, typeof session.sets>();
    for (const set of session.sets) {
      if (set.isWarmup) continue;
      const key = exerciseKey(set.exerciseName);
      byExercise.set(key, [...(byExercise.get(key) ?? []), set]);
    }
    for (const [key, sets] of byExercise) {
      if (result[key]) continue;
      result[key] = {
        sessionDate: session.sessionDate,
        sets: [...sets]
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((s) => ({ weight: s.weight, reps: s.reps })),
      };
    }
  }

  return result;
}

/** "165 x 8, 8, 7" (weight repeated only when it changes). */
export function formatLastPerformance(last: LastExercisePerformance) {
  const parts: string[] = [];
  let previousWeight: number | null | undefined;
  for (const set of last.sets) {
    if (set.reps == null && set.weight == null) continue;
    if (set.weight != null && set.weight !== previousWeight) {
      parts.push(
        set.reps != null ? `${set.weight} x ${set.reps}` : `${set.weight} lb`,
      );
    } else {
      parts.push(set.reps != null ? `${set.reps}` : "");
    }
    previousWeight = set.weight;
  }
  return parts.filter(Boolean).join(", ");
}

/**
 * Starting weight for set `index` of a loaded plan: what was lifted in the
 * same set last time, else the last set's weight, else the template target.
 */
export function startingWeight(
  last: LastExercisePerformance | undefined,
  index: number,
  templateTarget: number | null,
): string {
  const fromLast = last
    ? (last.sets[index]?.weight ?? last.sets[last.sets.length - 1]?.weight)
    : null;
  const value = fromLast ?? templateTarget;
  return value != null ? String(value) : "";
}
