/**
 * Pure helpers for the program screens. Web tests cannot load the workspace
 * packages at runtime, so nothing here imports them except as types.
 */
import type {
  PlannedExercise,
  PlannedExerciseStatus,
} from "@fitness-app/application";
import type { ProgramSessionType } from "@fitness-app/domain";

export type SessionCompletion =
  | "skipped"
  | "stopped"
  | "done"
  | "missed"
  | "today"
  | "planned"
  | "none";

/**
 * Lift days are done once a strength session with sets exists that day;
 * rides once any ride is logged or synced (a skipped one does not count).
 * An explicit skip or red-flag stop wins over everything, so a skipped day
 * reads as a choice, not a silent miss. Test days and walk-jog are not
 * tracked.
 */
export function sessionCompletion(input: {
  type: ProgramSessionType;
  date: string;
  today: string;
  liftDates: Set<string>;
  rideDates: Set<string>;
  outcome?: "skipped" | "stopped" | null;
}): SessionCompletion {
  const { type, date, today } = input;
  if (input.outcome) return input.outcome;
  const tracked = type === "lift" || type === "peloton";
  if (!tracked) return "none";
  const done =
    type === "lift" ? input.liftDates.has(date) : input.rideDates.has(date);
  if (done) return "done";
  if (date < today) return "missed";
  if (date === today) return "today";
  return "planned";
}

const RANGE_DASH = "–";

function range(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  if (min == null || max == null || min === max) return `${min ?? max}`;
  return `${min}${RANGE_DASH}${max}`;
}

/** "3 x 10–12 @ RIR 2 per leg", "3 x 20 s per leg", "5 x 5 s, peak N per leg". */
export function formatPrescription(
  p: Pick<PlannedExercise, "sets" | "scheme"> & {
    exercise: Pick<
      PlannedExercise["exercise"],
      "measure" | "sideMode" | "secondsTarget" | "tempo"
    >;
  },
): string {
  const perLeg = p.exercise.sideMode === "per_leg" ? " per leg" : "";
  if (p.exercise.measure === "time") {
    const seconds = p.exercise.secondsTarget;
    const time =
      seconds != null && seconds >= 120
        ? `${seconds / 60} min`
        : `${seconds ?? "?"} s`;
    return `${p.sets} x ${time}${perLeg}`;
  }
  if (p.exercise.measure === "force") {
    return `${p.sets} x ${p.exercise.secondsTarget ?? 5} s, peak N${perLeg}`;
  }
  const reps = range(p.scheme.repsMin, p.scheme.repsMax) ?? "?";
  const rir = p.scheme.rirTarget != null ? ` @ RIR ${p.scheme.rirTarget}` : "";
  const tempo = p.exercise.tempo ? `, ${p.exercise.tempo}` : "";
  return `${p.sets} x ${reps}${rir}${perLeg}${tempo}`;
}

export const STATUS_LABEL: Record<PlannedExerciseStatus, string | null> = {
  active: null,
  substitute: "Substitute",
  locked: "Locked",
  readiness_hidden: "Off today",
};

/** Hard leg sets vs the 12-16 target: under, on, over. */
export function hardSetBand(
  count: number,
  target: { min: number; max: number },
): "under" | "on" | "over" {
  if (count < target.min) return "under";
  if (count > target.max) return "over";
  return "on";
}

/** Left vs right as a percentage (left / right), null without both. */
export function limbSymmetryPct(
  left: number | null | undefined,
  right: number | null | undefined,
): number | null {
  if (left == null || right == null || right <= 0) return null;
  return Math.round((left / right) * 100);
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayShort(dayOfWeek: number) {
  return DAY_SHORT[dayOfWeek] ?? "";
}

/** "Oct 26" from YYYY-MM-DD, timezone-proof. */
export function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** Labels for skip reasons and red flags. */
export const SKIP_LABELS: Record<string, string> = {
  time: "Time",
  knee: "Knee",
  sick: "Sick",
  travel: "Travel",
  other: "Other",
  giving_way: "Giving way",
  locking: "Locking",
  sharp_pain: "Sharp pain",
};
