import type { StrengthSession } from "@fitness-app/domain";
import type { LoggerPlanExercise, RestMeta } from "@fitness-app/application";
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
    ...(partial?.side ? { side: partial.side } : {}),
    ...(partial?.peakForceNewtons !== undefined
      ? { peakForceNewtons: partial.peakForceNewtons }
      : {}),
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
            ...(set.side ? { side: set.side } : {}),
            ...(set.peakForceNewtons != null
              ? { peakForceNewtons: numberToInput(set.peakForceNewtons) }
              : {}),
            notes: set.notes ?? "",
          }))
        : [createEmptyStrengthSet()],
  };
}

/** Calendar-date arithmetic on YYYY-MM-DD strings, immune to DST and timezone. */
export function shiftIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "60s"; seconds match how timed sets are logged. */
export function formatDuration(seconds: number) {
  return `${seconds}s`;
}

export function formatStrengthDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatTopSet(
  weight: number | null,
  reps: number | null,
  durationSeconds: number | null = null,
) {
  const load = weight != null && weight > 0 ? weight : null;

  if (reps == null && durationSeconds != null) {
    const time = formatDuration(durationSeconds);
    return load != null ? `${load} x ${time}` : time;
  }

  if (load != null && reps != null) {
    return `${load} x ${reps}`;
  }

  if (load != null) {
    return `${load} lb`;
  }

  if (reps != null) {
    return `${reps} reps`;
  }

  return "--";
}

export type LastExercisePerformance = {
  sessionDate: string;
  /** Working sets only (warm-ups excluded), in set order. */
  sets: {
    weight: number | null;
    reps: number | null;
    durationSeconds: number | null;
    /** Present only when logged. */
    rir?: number;
    side?: "left" | "right";
    peakForceNewtons?: number;
  }[];
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
          .map((s) => ({
            weight: s.weight,
            reps: s.reps,
            durationSeconds: s.durationSeconds ?? null,
            ...(s.rir != null ? { rir: s.rir } : {}),
            ...(s.side ? { side: s.side } : {}),
            ...(s.peakForceNewtons != null
              ? { peakForceNewtons: s.peakForceNewtons }
              : {}),
          })),
      };
    }
  }

  return result;
}

/**
 * "165 x 8, 8, 7" (weight repeated only when it changes); "30s, 25s" for timed
 * sets; per-leg work splits by leg: "L 10 x 12, 12 · R 10 x 12, 11"; force
 * sets show peak newtons: "L 410 N · R 520 N".
 */
export function formatLastPerformance(last: LastExercisePerformance): string {
  if (last.sets.some((set) => set.side)) {
    return (["left", "right"] as const)
      .map((side) => {
        const sets = last.sets.filter((set) => set.side === side);
        if (sets.length === 0) return "";
        const label = side === "left" ? "L" : "R";
        const peaks = sets
          .map((set) => set.peakForceNewtons)
          .filter((n): n is number => n != null);
        if (peaks.length > 0) return `${label} ${Math.max(...peaks)} N`;
        const body = formatLastPerformance({
          ...last,
          sets: sets.map((set) => ({ ...set, side: undefined })),
        });
        return body ? `${label} ${body}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  const parts: string[] = [];
  let previousWeight: number | null | undefined;
  for (const set of last.sets) {
    if (set.reps == null && set.durationSeconds != null) {
      parts.push(
        set.weight != null
          ? `${set.weight} x ${set.durationSeconds}s`
          : `${set.durationSeconds}s`,
      );
      continue;
    }
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

const REP_RANGE_PATTERN = /(\d+)\s*[-–]\s*(\d+)/;

/** Top of a rep target: "8-12" -> 12, "10" or 10 -> 10; null when missing or unreadable. */
export function repRangeTop(
  target: number | string | null | undefined,
): number | null {
  if (typeof target === "number") {
    return Number.isInteger(target) && target > 0 ? target : null;
  }
  if (typeof target !== "string") return null;
  const range = target.match(REP_RANGE_PATTERN);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    return high >= low && high > 0 ? high : null;
  }
  const single = target.trim();
  return /^\d+$/.test(single) && Number(single) > 0 ? Number(single) : null;
}

/**
 * Top of the rep range for a template exercise. Templates store one target
 * (Lateral Raise 4x18); a range written in its notes ("18-20") that includes
 * that target sets the top instead.
 */
export function templateRepTop(
  targetReps: number | null,
  notes: string | null,
): number | null {
  const range = notes?.match(REP_RANGE_PATTERN);
  if (range && targetReps != null) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (low <= targetReps && targetReps <= high) return high;
  }
  return repRangeTop(targetReps);
}

/**
 * Plan load rule: "hit the top of the rep range on all sets, then add weight
 * next session". True only when every working set last time reached the top
 * of the range at one logged weight. Timed or distance work, bodyweight sets,
 * mixed weights, or a missing target never qualify. Does not pick a load.
 */
export function readyToAddLoad(
  lastSets:
    | {
        weight: number | null;
        reps: number | null;
        durationSeconds?: number | null;
        distanceMeters?: number | null;
        isWarmup?: boolean;
      }[]
    | undefined,
  targetReps: number | string | null | undefined,
): boolean {
  const top = repRangeTop(targetReps);
  const working = (lastSets ?? []).filter((set) => !set.isWarmup);
  if (top == null || working.length === 0) return false;
  const weight = working[0]?.weight;
  if (weight == null || weight <= 0) return false;
  return working.every(
    (set) =>
      set.durationSeconds == null &&
      set.distanceMeters == null &&
      set.weight === weight &&
      set.reps != null &&
      set.reps >= top,
  );
}

/** Rep gap beyond which last time's load is not a fair start for the plan. */
const REP_MISMATCH_LIMIT = 3;

/**
 * Starting weight for set `index` of a loaded plan: what was lifted in the
 * same set last time, else the last set's weight, else the template target.
 * When the plan's reps are far from last time's (lateral raise 4x18 on Tuesday
 * vs 3x15 heavier on Saturday), last time's load does not carry over, so the
 * template target wins.
 */
export function startingWeight(
  last: LastExercisePerformance | undefined,
  index: number,
  templateTarget: number | null,
  templateReps: number | null = null,
): string {
  const lastSet = last
    ? (last.sets[index] ?? last.sets[last.sets.length - 1])
    : undefined;
  const repsMismatch =
    templateTarget != null &&
    templateReps != null &&
    lastSet?.reps != null &&
    Math.abs(lastSet.reps - templateReps) > REP_MISMATCH_LIMIT;
  const fromLast = repsMismatch
    ? null
    : last
      ? (last.sets[index]?.weight ?? last.sets[last.sets.length - 1]?.weight)
      : null;
  const value = fromLast ?? templateTarget;
  return value != null ? String(value) : "";
}

const TIMED_EXERCISE_PATTERN = /hang|plank|carry|hold|wall sit|balance/i;
const LOADED_TIMED_PATTERN = /carry/i;

/** Timed movements log seconds instead of reps. */
export function isTimedSet(set: {
  exerciseName: string;
  durationSeconds: string;
}) {
  return (
    set.durationSeconds !== "" || TIMED_EXERCISE_PATTERN.test(set.exerciseName)
  );
}

export type ExerciseGroup = {
  key: string;
  name: string;
  indexes: number[];
};

/** Groups consecutive sets of the same exercise, preserving flat indexes. */
export function groupSetsByExercise(
  sets: { exerciseName: string }[],
): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  sets.forEach((set, index) => {
    const key = exerciseKey(set.exerciseName);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.indexes.push(index);
    } else {
      groups.push({ key, name: set.exerciseName, indexes: [index] });
    }
  });
  return groups;
}

/** Sets to persist: ticked ones if any were ticked, otherwise everything. */
export function selectSetsToSave<T extends { done?: boolean }>(sets: T[]) {
  return sets.some((set) => set.done) ? sets.filter((set) => set.done) : sets;
}

/** Renumbers sets 1..n within each consecutive exercise group. */
export function renumberSets<
  T extends { exerciseName: string; setNumber: number },
>(sets: T[]): T[] {
  const counts = new Map<string, number>();
  let previous = "";
  return sets.map((set) => {
    const key = exerciseKey(set.exerciseName);
    const next = key === previous ? (counts.get(key) ?? 0) + 1 : 1;
    counts.set(key, next);
    previous = key;
    return { ...set, setNumber: next };
  });
}

/** Starting seconds for a timed set: same set last time, else the last set. */
export function startingDuration(
  last: LastExercisePerformance | undefined,
  index: number,
): string {
  const fromLast = last
    ? (last.sets[index]?.durationSeconds ??
      last.sets[last.sets.length - 1]?.durationSeconds)
    : null;
  return fromLast != null ? String(fromLast) : "";
}

/**
 * Timed sets that carry a load (farmer carry, weighted hang) also show the
 * weight stepper, so a "half bodyweight per hand for 1 min" carry logs both.
 */
export function showsTimedWeight(set: {
  exerciseName: string;
  weight: string;
}) {
  return set.weight !== "" || LOADED_TIMED_PATTERN.test(set.exerciseName);
}

/**
 * An in-progress workout kept in localStorage, so an iOS tab reload or a
 * tab-bar tap mid-workout does not lose the ticked sets. `submittedAt` is set
 * when Finish is tapped; the draft is dropped once a session created at or
 * after that time shows up from the server.
 */
export type StrengthDraft = {
  savedAt: number;
  submittedAt?: number;
  values: StrengthFormValues;
  exerciseNotes: Record<string, string>;
  planNotes: string | null;
  /** Top of each loaded plan exercise's rep range, by exercise key. */
  repTops?: Record<string, number>;
  /** Program rows' rest rules (superset, side, category), by exercise key. */
  restMeta?: RestMeta;
};

export const STRENGTH_DRAFT_KEY = "fitness-app:strength-draft:v1";
const DRAFT_MAX_AGE_MS = 18 * 60 * 60 * 1000;
// Phone and server clocks differ by a few seconds; a two-minute window still
// rules out matching a session saved before this workout started.
const SAVE_CLOCK_SKEW_MS = 2 * 60 * 1000;

/** Parses a stored draft; null when missing, malformed, empty or stale. */
export function parseStrengthDraft(
  raw: string | null,
  nowMs: number,
): StrengthDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as StrengthDraft;
    if (
      typeof draft?.savedAt !== "number" ||
      nowMs - draft.savedAt > DRAFT_MAX_AGE_MS ||
      !Array.isArray(draft.values?.sets) ||
      !draft.values.sets.some((set) => set.exerciseName?.trim())
    ) {
      return null;
    }
    return {
      ...draft,
      exerciseNotes: draft.exerciseNotes ?? {},
      planNotes: draft.planNotes ?? null,
      repTops: draft.repTops ?? {},
      restMeta: draft.restMeta ?? {},
    };
  } catch {
    return null;
  }
}

/** True once the server has a session created at or after the draft's Finish tap. */
export function draftWasSaved(
  draft: Pick<StrengthDraft, "submittedAt">,
  latestCreatedAt: string | null,
): boolean {
  if (draft.submittedAt == null || !latestCreatedAt) return false;
  const created = Date.parse(latestCreatedAt);
  return (
    Number.isFinite(created) &&
    created >= draft.submittedAt - SAVE_CLOCK_SKEW_MS
  );
}

/** "L2" / "R2" for per-leg sets (counted within each leg), else the set number. */
export function setLabel(
  sets: { side?: "left" | "right" | "" }[],
  indexes: number[],
  index: number,
  setNumber: number,
): string {
  const side = sets[index]?.side;
  if (!side) return `${setNumber}`;
  const position =
    indexes.filter((i) => i <= index && sets[i]?.side === side).length || 1;
  return `${side === "left" ? "L" : "R"}${position}`;
}

/** Isometric sets log peak newtons instead of weight and reps. */
export function isForceSet(set: { peakForceNewtons?: string }) {
  return set.peakForceNewtons !== undefined;
}

/**
 * After the left leg's reps change, the matching right-leg set (same
 * position within its leg, same exercise group) takes those reps as its
 * target, unless it is already ticked done.
 */
export function withRightRepsFromLeft<
  T extends {
    side?: "left" | "right" | "";
    reps: string;
    done?: boolean;
  },
>(sets: T[], groupIndexes: number[], leftIndex: number, leftReps: string): T[] {
  if (sets[leftIndex]?.side !== "left") return sets;
  const position = groupIndexes.filter(
    (i) => i <= leftIndex && sets[i]?.side === "left",
  ).length;
  const rights = groupIndexes.filter((i) => sets[i]?.side === "right");
  const target = rights[position - 1];
  if (target == null || sets[target]?.done) return sets;
  // Same rule as rightLegRepsTarget in @fitness-app/application (web tests
  // cannot load workspace packages at runtime).
  const reps = Number(leftReps);
  if (leftReps.trim() === "" || !Number.isInteger(reps) || reps <= 0) {
    return sets;
  }
  return sets.map((set, i) =>
    i === target ? { ...set, reps: String(reps) } : set,
  );
}

/**
 * Logger rows for one plan exercise. Per-leg work alternates left then right
 * (L1, R1, L2, R2). Program leg work takes the engine's load as is; template
 * exercises keep the last-logged prefill. Timed and isometric work prefill
 * seconds; isometrics also get an empty peak-newtons field.
 */
export function planExerciseSets(
  ex: LoggerPlanExercise,
  last: LastExercisePerformance | undefined,
): (StrengthSetFormValue & { done: boolean })[] {
  const sides: ("left" | "right" | null)[] =
    ex.sideMode === "per_leg" ? ["left", "right"] : [null];
  const force = ex.measure === "force";
  const timed = ex.measure === "time" || force;
  const rows: (StrengthSetFormValue & { done: boolean })[] = [];
  for (let i = 0; i < ex.targetSets; i += 1) {
    for (const side of sides) {
      const weight = timed
        ? ""
        : ex.program
          ? ex.targetWeight != null
            ? String(ex.targetWeight)
            : ""
          : startingWeight(last, i, ex.targetWeight, ex.targetReps);
      const seconds = timed
        ? ex.targetSeconds != null
          ? String(ex.targetSeconds)
          : force
            ? "5"
            : ""
        : ex.program
          ? ""
          : startingDuration(last, i);
      rows.push({
        exerciseName: ex.exerciseName,
        setNumber: rows.length + 1,
        reps: !timed && ex.targetReps != null ? String(ex.targetReps) : "",
        weight,
        rir: !timed && ex.targetRir != null ? String(ex.targetRir) : "",
        isWarmup: false,
        durationSeconds: seconds,
        distanceMeters:
          ex.measure === "distance" && ex.targetDistanceMeters != null
            ? String(ex.targetDistanceMeters)
            : "",
        notes: "",
        done: false,
        ...(side ? { side } : {}),
        ...(force ? { peakForceNewtons: "" } : {}),
      });
    }
  }
  return rows;
}
