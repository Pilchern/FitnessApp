import type {
  BlockPart,
  IsoDate,
  KneeReadinessStatus,
  LoadKind,
  ProgramBlock,
  ProgramExercise,
  ProgramGate,
  ProgramSession,
  RideKind,
  TrainingProgram,
} from "@fitness-app/domain";
import {
  addDays,
  isGateCleared,
  programWeekInfo,
  type ProgramWeekInfo,
} from "./program-calendar";
import {
  effectiveScheme,
  plannedSetCount,
  type PrescriptionScheme,
} from "./program-progression";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
} from "./program-settings";

/** Replaces the leg block on a knee day off (length from settings). */
export const KNEE_OFF_BLOCK = {
  name: "Knee day off: ROM + easy walk",
  notes: "Heel slides, prone hang, quad sets, then an easy walk.",
} as const;

/** The first of an exercise's gates still closed on `date`; null when all are clear. */
export function closedGate(
  gates: Pick<ProgramGate, "gateKey" | "clearedOn">[],
  exercise: Pick<ProgramExercise, "gateKey" | "extraGateKey">,
  date: IsoDate,
): string | null {
  for (const key of [exercise.gateKey, exercise.extraGateKey ?? null]) {
    if (key != null && !isGateCleared(gates, key, date)) return key;
  }
  return null;
}

function gateLabel(gates: ProgramGate[], key: string) {
  return gates.find((g) => g.gateKey === key)?.label ?? key;
}

/** A block's own sessions, else the sessions of the block it repeats. */
export function sessionsForBlock(
  program: Pick<TrainingProgram, "sessions" | "blocks">,
  block: ProgramBlock,
): ProgramSession[] {
  const own = program.sessions.filter((s) => s.blockId === block.id);
  if (own.length > 0 || !block.sessionsFromBlockId) return own;
  return program.sessions.filter(
    (s) => s.blockId === block.sessionsFromBlockId,
  );
}

export type PlannedExerciseStatus =
  | "active"
  | "substitute"
  | "locked"
  | "readiness_hidden";

export type PlannedExercise = {
  exercise: ProgramExercise;
  part: BlockPart;
  status: PlannedExerciseStatus;
  /** What to do today: the substitute's name while the gate is closed. */
  name: string;
  loadKind: LoadKind;
  /** Why it is greyed out; null when it runs today. */
  lockedReason: string | null;
  scheme: PrescriptionScheme;
  sets: number;
};

export type PlanContext = {
  gates: ProgramGate[];
  week: number;
  date: IsoDate;
  readiness: KneeReadinessStatus | null;
  block: ProgramBlock | null;
  sourceBlock: ProgramBlock | null;
  weekIndexInBlock: number;
  isDeload: boolean;
};

/**
 * Gate first: a closed gate (either of two) shows the substitute, with its
 * own rep range when it has one, or greys the exercise out. On a
 * repeat-loads (hold) day gated work is off too, even once cleared (the
 * substitute runs instead when there is one). Then readiness: "normal only"
 * work (landing prep, plyos) waits for a normal check. Deloads take one set
 * off everything and halve plyo sets.
 */
export function planExercise(
  exercise: ProgramExercise,
  ctx: PlanContext,
): PlannedExercise {
  const scheme = effectiveScheme(exercise, ctx.block, ctx.sourceBlock);
  const part = exercise.blockPart;
  const sets = plannedSetCount(
    scheme,
    ctx.weekIndexInBlock,
    ctx.isDeload,
    exercise.category ?? null,
  );
  const base = {
    exercise,
    part,
    name: exercise.name,
    loadKind: exercise.loadKind,
    scheme,
    sets,
  };

  const closed = closedGate(ctx.gates, exercise, ctx.date);
  const gateClosed = closed != null;
  const holdOff =
    ctx.readiness === "hold" &&
    (exercise.gateKey != null || exercise.extraGateKey != null);
  if (gateClosed || holdOff) {
    if (exercise.substituteName) {
      const ownReps =
        exercise.substituteRepsMin != null ||
        exercise.substituteRepsMax != null;
      return {
        ...base,
        status: "substitute",
        name: exercise.substituteName,
        loadKind: exercise.substituteLoadKind ?? exercise.loadKind,
        scheme: ownReps
          ? {
              ...scheme,
              repsMin: exercise.substituteRepsMin ?? exercise.substituteRepsMax,
              repsMax: exercise.substituteRepsMax ?? exercise.substituteRepsMin,
            }
          : scheme,
        lockedReason: null,
      };
    }
    return {
      ...base,
      status: gateClosed ? "locked" : "readiness_hidden",
      lockedReason: gateClosed
        ? `Waiting on gate: ${gateLabel(ctx.gates, closed)}`
        : "Off on a repeat-loads day",
    };
  }

  if (
    exercise.readinessRequirement === "normal" &&
    ctx.readiness !== "normal"
  ) {
    return {
      ...base,
      status: "readiness_hidden",
      lockedReason:
        ctx.readiness == null
          ? "Needs a normal knee check"
          : "Off today: knee check not normal",
    };
  }

  return { ...base, status: "active", lockedReason: null };
}

/** True when the exercise runs in `week` (its from/until window, inclusive). */
export function inWeekWindow(
  ex: Pick<ProgramExercise, "fromWeek" | "untilWeek">,
  week: number,
) {
  return (
    (ex.fromWeek == null || week >= ex.fromWeek) &&
    (ex.untilWeek == null || week <= ex.untilWeek)
  );
}

export function isPlannedToday(p: PlannedExercise) {
  return p.status === "active" || p.status === "substitute";
}

export const RIDE_KIND_LABEL: Record<RideKind, string> = {
  zone2: "Zone 2",
  climb_intervals: "Climb intervals",
  threshold_intervals: "4 x 4 min intervals",
  vo2_intervals: "VO2 max intervals",
};

export type PlannedRide = {
  kind: RideKind;
  minutesMin: number | null;
  minutesMax: number | null;
  structure: string | null;
  note: string | null;
};

export type PlannedSession = {
  session: ProgramSession;
  /** False when a gate or readiness keeps the whole session off today. */
  visible: boolean;
  hiddenReason: string | null;
  exercises: PlannedExercise[];
  /** Knee day off on a lift day: the leg block is swapped for ROM + walk. */
  legBlockReplaced: boolean;
  ride: PlannedRide | null;
};

export type DayPlan = {
  date: IsoDate;
  info: ProgramWeekInfo;
  readiness: KneeReadinessStatus | null;
  sessions: PlannedSession[];
};

function walkJogAllowed(
  session: ProgramSession,
  gates: ProgramGate[],
  date: IsoDate,
  readiness: KneeReadinessStatus | null,
): { ok: boolean; reason: string | null } {
  if (!isGateCleared(gates, session.gateKey, date)) {
    return {
      ok: false,
      reason: `Waiting on gate: ${gateLabel(gates, session.gateKey ?? "")}`,
    };
  }
  // Belt and braces: the table already forbids walk-jog on lift days.
  if ([1, 3, 5].includes(session.dayOfWeek)) {
    return { ok: false, reason: "Walk-jog never runs on a lift day." };
  }
  if (readiness === "hold" || readiness === "knee_off") {
    return { ok: false, reason: "No running unless the knee check is normal." };
  }
  return { ok: true, reason: null };
}

/**
 * Everything planned for `date`, with gates, deload and the knee check
 * applied:
 * - knee_off: lift days swap the leg block for ROM + walk (upper still runs);
 *   climb intervals become Zone 2; walk-jog is off.
 * - hold: "normal only" exercises and walk-jog are off; loads repeat.
 * - walk-jog (jog gate cleared) cuts the same day's ride to 15-20 min.
 * Exercises outside their week window (from/until week) are left out.
 */
export function buildDayPlan(
  program: TrainingProgram,
  date: IsoDate,
  readiness: KneeReadinessStatus | null,
  settings: Pick<
    ProgramSettings,
    "rideAfterWalkJogMin" | "rideAfterWalkJogMax"
  > = DEFAULT_PROGRAM_SETTINGS,
): DayPlan {
  const info = programWeekInfo(program, date);
  const block = info.block;
  if (!block) return { date, info, readiness, sessions: [] };

  const sourceBlock = block.sessionsFromBlockId
    ? (program.blocks.find((b) => b.id === block.sessionsFromBlockId) ?? null)
    : null;
  const ctx: PlanContext = {
    gates: program.gates,
    week: info.week,
    date,
    readiness,
    block,
    sourceBlock,
    weekIndexInBlock: info.weekIndexInBlock,
    isDeload: info.isDeload,
  };

  const todays = sessionsForBlock(program, block)
    .filter((s) => s.dayOfWeek === info.dayOfWeek)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const walkJogToday = todays.some(
    (s) =>
      s.sessionType === "walk_jog" &&
      walkJogAllowed(s, program.gates, date, readiness).ok,
  );

  const sessions = todays.map((session): PlannedSession => {
    const exercises = [...session.exercises]
      .filter((ex) => inWeekWindow(ex, info.week))
      .sort((a, b) => a.order - b.order)
      .map((ex) => planExercise(ex, ctx));

    if (session.sessionType === "walk_jog") {
      const allowed = walkJogAllowed(session, program.gates, date, readiness);
      return {
        session,
        visible: allowed.ok,
        hiddenReason: allowed.reason,
        exercises,
        legBlockReplaced: false,
        ride: null,
      };
    }

    const gateOpen = isGateCleared(program.gates, session.gateKey, date);

    let ride: PlannedRide | null = null;
    if (session.sessionType === "peloton") {
      ride = {
        kind: session.rideKind ?? "zone2",
        minutesMin: session.minutesMin,
        minutesMax: session.minutesMax,
        structure: session.structure,
        note: null,
      };
      if (readiness === "knee_off" && ride.kind !== "zone2") {
        ride = {
          ...ride,
          kind: "zone2",
          structure: null,
          note: "Knee day off: Zone 2 instead of intervals.",
        };
      }
      if (walkJogToday) {
        ride = {
          ...ride,
          minutesMin: settings.rideAfterWalkJogMin,
          minutesMax: settings.rideAfterWalkJogMax,
          note: [ride.note, "Shortened: walk-jog first."]
            .filter(Boolean)
            .join(" "),
        };
      }
    }

    return {
      session,
      visible: gateOpen,
      hiddenReason: gateOpen
        ? null
        : `Waiting on gate: ${gateLabel(program.gates, session.gateKey ?? "")}`,
      exercises,
      legBlockReplaced:
        session.sessionType === "lift" && readiness === "knee_off",
      ride,
    };
  });

  return { date, info, readiness, sessions };
}

/** Monday to Sunday of the post-op week holding `date`. */
export function programWeekDates(
  program: Pick<TrainingProgram, "weekAnchorDate" | "blocks" | "weeks">,
  date: IsoDate,
): IsoDate[] {
  const { weekStart } = programWeekInfo(program, date);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Right-leg rep target: what the left leg just did, else the prescription.
 * The left (operated) leg sets the work; the right matches it.
 */
export function rightLegRepsTarget(
  leftLoggedReps: string | number | null | undefined,
  prescribedReps: number | null,
): number | null {
  const left =
    typeof leftLoggedReps === "number"
      ? leftLoggedReps
      : leftLoggedReps != null && leftLoggedReps.trim() !== ""
        ? Number(leftLoggedReps)
        : NaN;
  return Number.isInteger(left) && left > 0 ? left : prescribedReps;
}

/**
 * Top of the rep range an exercise was prescribed on `date` (looked up by
 * name, or by its substitute's name). Tells the progression engine whether
 * last time's sets came from a different rep scheme, i.e. a new block.
 */
export function prescribedRepsMaxOn(
  program: TrainingProgram,
  exerciseName: string,
  date: IsoDate,
): number | null {
  const info = programWeekInfo(program, date);
  const block = info.block;
  if (!block) return null;
  const sourceBlock = block.sessionsFromBlockId
    ? (program.blocks.find((b) => b.id === block.sessionsFromBlockId) ?? null)
    : null;
  const key = exerciseName.trim().toLowerCase();
  for (const session of sessionsForBlock(program, block)) {
    for (const ex of session.exercises.filter((e) =>
      inWeekWindow(e, info.week),
    )) {
      const names = [ex.name, ex.substituteName].filter(
        (n): n is string => n != null,
      );
      if (names.some((n) => n.trim().toLowerCase() === key)) {
        return effectiveScheme(ex, block, sourceBlock).repsMax;
      }
    }
  }
  return null;
}
