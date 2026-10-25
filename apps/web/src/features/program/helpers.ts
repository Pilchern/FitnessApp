/**
 * Pure helpers for the program screens. Web tests cannot load the workspace
 * packages at runtime, so nothing here imports them except as types.
 */
import type {
  PlannedExercise,
  PlannedExerciseStatus,
} from "@fitness-app/application";
import type { ProgramSessionType, StrengthSession } from "@fitness-app/domain";

export type SessionCompletion =
  | "skipped"
  | "stopped"
  | "done"
  | "missed"
  | "today"
  | "planned"
  | "none";

/** A logged lift (with sets) started from the program, linked to its session. */
export type LinkedLift = {
  id: string;
  programSessionId: string;
  /** The lift's own session date, which can be after the scheduled day. */
  date: string;
};

/**
 * Days after its scheduled date that a linked lift still counts for that
 * occurrence. A program session recurs weekly, so one occurrence's window
 * never reaches the next.
 */
export const LATE_LOG_DAYS = 6;

function daysFrom(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

/**
 * The linked lift that fulfils program session `sessionId` scheduled on
 * `date`: linked to that session and dated that day or up to LATE_LOG_DAYS
 * later. The latest dated wins; null when there is none.
 */
export function linkedLiftFor(
  lifts: readonly LinkedLift[],
  sessionId: string,
  date: string,
): LinkedLift | null {
  let found: LinkedLift | null = null;
  for (const lift of lifts) {
    if (lift.programSessionId !== sessionId) continue;
    const late = daysFrom(date, lift.date);
    if (late < 0 || late > LATE_LOG_DAYS) continue;
    if (!found || lift.date >= found.date) found = lift;
  }
  return found;
}

/**
 * Splits logged lifts (with sets, oldest first) into linked lifts and the
 * date fallback. A lift links only to a session the program still has
 * (`knownSessionIds`); any other link falls back to its date, as do
 * unlinked lifts. `liftIdByDate` keeps the latest unlinked lift per day.
 */
export function splitLoggedLifts(
  lifts: readonly Pick<
    StrengthSession,
    "id" | "sessionDate" | "programSessionId"
  >[],
  knownSessionIds: ReadonlySet<string>,
): {
  liftDates: Set<string>;
  liftIdByDate: Map<string, string>;
  linkedLifts: LinkedLift[];
} {
  const liftDates = new Set<string>();
  const liftIdByDate = new Map<string, string>();
  const linkedLifts: LinkedLift[] = [];
  for (const lift of lifts) {
    const programSessionId = lift.programSessionId ?? null;
    if (programSessionId != null && knownSessionIds.has(programSessionId)) {
      linkedLifts.push({
        id: lift.id,
        programSessionId,
        date: lift.sessionDate,
      });
    } else {
      liftDates.add(lift.sessionDate);
      liftIdByDate.set(lift.sessionDate, lift.id);
    }
  }
  return { liftDates, liftIdByDate, linkedLifts };
}

/**
 * Lift days are done once a lift linked to that program session is logged
 * (that day or late, see linkedLiftFor), or else once an unlinked lift with
 * sets (manual logging, older rows) exists that day. `liftDates` holds only
 * unlinked lifts, so a late log never marks the day it was logged on.
 * Rides are done once any ride is logged or synced (a skipped one does not
 * count). An explicit skip or red-flag stop wins, so a skipped day reads
 * as a choice, not a silent miss; a skipped lift made up later (a linked
 * lift dated after it) reads as done. Test days and walk-jog
 * are not tracked.
 */
export function sessionCompletion(input: {
  type: ProgramSessionType;
  date: string;
  today: string;
  liftDates: Set<string>;
  rideDates: Set<string>;
  outcome?: "skipped" | "stopped" | null;
  /** The program session's id, matched against linked lifts. */
  sessionId?: string;
  linkedLifts?: readonly LinkedLift[];
}): SessionCompletion {
  const { type, date, today } = input;
  if (input.outcome === "stopped") return "stopped";
  const tracked = type === "lift" || type === "peloton";
  if (!tracked) return input.outcome ?? "none";
  const linked =
    type === "lift" && input.sessionId != null
      ? linkedLiftFor(input.linkedLifts ?? [], input.sessionId, date)
      : null;
  // A skipped lift made up on a later day counts as done.
  if (input.outcome === "skipped") {
    return linked != null && linked.date > date ? "done" : "skipped";
  }
  const done =
    type === "lift"
      ? linked != null || input.liftDates.has(date)
      : input.rideDates.has(date);
  if (done) return "done";
  if (date < today) return "missed";
  if (date === today) return "today";
  return "planned";
}

export type MakeUpCall =
  | { eligible: true; warning: string | null }
  | { eligible: false; reason: string };

/**
 * Can this lift or ride be made up today? Only a missed or skipped (not
 * red-flag stopped) session from earlier in the same post-op week, so a
 * make-up never spills into the next block. Never two of the same kind on
 * one day: not on a day with its own lift (ride) or once one is logged
 * (planned) today. A lift and a ride on the same day is fine. Warns before
 * back-to-back leg days. The knee check still gates the lift logger.
 */
export function makeUpCall(input: {
  type: ProgramSessionType;
  completion: SessionCompletion;
  date: string;
  today: string;
  /** First day of the post-op week holding today. */
  weekStart: string;
  /** Today has its own session of this type. */
  todayHasOwn: boolean;
  /** A session of this type is already logged (or a ride make-up planned) today. */
  alreadyToday: boolean;
  /** Tomorrow has a session of this type. */
  nextTomorrow: boolean;
}): MakeUpCall {
  if (input.type !== "lift" && input.type !== "peloton") {
    return { eligible: false, reason: "Only lifts and rides." };
  }
  const lift = input.type === "lift";
  if (input.completion !== "missed" && input.completion !== "skipped") {
    return { eligible: false, reason: "Nothing to make up." };
  }
  if (!(input.date < input.today) || input.date < input.weekStart) {
    return { eligible: false, reason: "Only earlier days this week." };
  }
  if (input.todayHasOwn) {
    return {
      eligible: false,
      reason: lift ? "Today has its own lift." : "Today has its own ride.",
    };
  }
  if (input.alreadyToday) {
    return {
      eligible: false,
      reason: lift
        ? "Already lifted today."
        : "A ride make-up is already set for today.",
    };
  }
  return {
    eligible: true,
    warning:
      lift && input.nextTomorrow
        ? "Next lift is tomorrow: back-to-back leg days."
        : null,
  };
}

export type RideMakeUp = { scheduledDate: string; madeUpOn: string };

/**
 * Ride dates with make-ups applied: a ride on a make-up day counts for the
 * scheduled day instead (and not again for its own day, so the week counts
 * it once). A make-up with no ride that day changes nothing.
 */
export function applyRideMakeUps(
  rideDates: ReadonlySet<string>,
  makeUps: readonly RideMakeUp[],
): Set<string> {
  const out = new Set(rideDates);
  for (const m of makeUps) {
    if (rideDates.has(m.madeUpOn)) {
      out.delete(m.madeUpOn);
      out.add(m.scheduledDate);
    }
  }
  return out;
}

/** /strength link that loads `sessionId` (scheduled on `date`) as a make-up. */
export function makeUpHref(sessionId: string, date: string) {
  return `/strength?makeup=${encodeURIComponent(sessionId)}&date=${date}`;
}

const RANGE_DASH = "–";

function range(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  if (min == null || max == null || min === max) return `${min ?? max}`;
  return `${min}${RANGE_DASH}${max}`;
}

/** "3 x 10–12 @ RIR 2 per leg", "3 x 20 s per leg", "5 x 5 s, peak N per leg"; ", +1 left" for extra left-leg sets. */
export function formatPrescription(
  p: Pick<PlannedExercise, "sets" | "scheme" | "leftExtraSets"> & {
    exercise: Pick<
      PlannedExercise["exercise"],
      "measure" | "sideMode" | "secondsTarget" | "tempo"
    > &
      Partial<Pick<PlannedExercise["exercise"], "distanceMetersTarget">>;
  },
): string {
  const perLeg =
    p.exercise.sideMode === "per_leg"
      ? " per leg"
      : p.exercise.sideMode === "per_side"
        ? " per side"
        : "";
  const extra = p.leftExtraSets ?? 0;
  const left = extra > 0 ? `, +${extra} left` : "";
  if (p.exercise.measure === "distance") {
    return `${p.sets} x ${p.exercise.distanceMetersTarget ?? "?"} m${perLeg}${left}`;
  }
  if (p.exercise.measure === "time") {
    const seconds = p.exercise.secondsTarget;
    const time =
      seconds != null && seconds >= 120
        ? `${seconds / 60} min`
        : `${seconds ?? "?"} s`;
    return `${p.sets} x ${time}${perLeg}${left}`;
  }
  if (p.exercise.measure === "force") {
    return `${p.sets} x ${p.exercise.secondsTarget ?? 5} s, peak N${perLeg}${left}`;
  }
  const reps = range(p.scheme.repsMin, p.scheme.repsMax) ?? "?";
  const rir = p.scheme.rirTarget != null ? ` @ RIR ${p.scheme.rirTarget}` : "";
  const tempo = p.exercise.tempo ? `, ${p.exercise.tempo}` : "";
  return `${p.sets} x ${reps}${rir}${perLeg}${tempo}${left}`;
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

/**
 * Scorecard colour: met the target, short of it, or no data yet. A week still
 * in progress is never "short": 1 of 3 on a Monday is on track, not behind.
 */
export function ratioTone(
  done: number | null | undefined,
  target: number | null | undefined,
  options: { inProgress?: boolean } = {},
): "met" | "short" | "none" {
  if (done == null || target == null || target <= 0) return "none";
  if (done >= target) return "met";
  return options.inProgress ? "none" : "short";
}
