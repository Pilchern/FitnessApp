import type { EntityId, IsoDate, UserId } from "../../shared/ids";

/**
 * A data-driven training program: blocks of post-op weeks, each with weekday
 * session templates and exercise prescriptions. New blocks are rows.
 */

export type ProgramSessionType =
  | "lift"
  | "peloton"
  | "run"
  | "test"
  | "rest"
  | "walk_jog"
  | "walk"
  | "golf"
  | "accessory";

export type RideKind =
  | "zone2"
  | "climb_intervals"
  | "threshold_intervals"
  | "vo2_intervals";
export type ExerciseMeasure = "reps" | "time" | "force" | "distance";
export type SideMode = "bilateral" | "per_leg" | "per_side";
/** Library category: plyo halves on a deload; the rest lose one set. */
export type ProgramExerciseCategory =
  | "main"
  | "accessory"
  | "plyo"
  | "core"
  | "conditioning"
  | "mobility";
/** week: by post-op week. gate: by week once a gate clears. manual: from a set date. */
export type BlockActivation = "week" | "gate" | "manual";
export type LoadKind = "barbell" | "dumbbell" | "cuff" | "bodyweight" | "band";
export type ReadinessRequirement = "any" | "normal";
export type BlockPart = "legs" | "upper";
export type ProgramMuscle =
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "adductors"
  | "core";

export type ProgramExercise = {
  id: EntityId;
  sessionId: EntityId;
  order: number;
  name: string;
  /** legs: knee work (engine, deloads, knee-off swap). upper: runs as logged. */
  blockPart: BlockPart;
  category: ProgramExerciseCategory | null;
  /** Counts toward the weekly hard quad set target. */
  countsAsQuadSet: boolean;
  /** One-line coaching cue. */
  cue: string | null;
  /** Only in these post-op weeks (inclusive); null = no limit. */
  fromWeek: number | null;
  untilWeek: number | null;
  primaryMuscle: ProgramMuscle | null;
  readinessRequirement: ReadinessRequirement;
  measure: ExerciseMeasure;
  sideMode: SideMode;
  loadKind: LoadKind;
  /** Null fields fall back to the block's scheme. */
  setsMin: number | null;
  setsMax: number | null;
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
  secondsTarget: number | null;
  distanceMetersTarget: number | null;
  tempo: string | null;
  gateKey: string | null;
  /** A second gate that must also be cleared. */
  extraGateKey: string | null;
  substituteName: string | null;
  substituteLoadKind: LoadKind | null;
  /** The fallback's own rep range; null = same as the exercise. */
  substituteRepsMin: number | null;
  substituteRepsMax: number | null;
  /** Superset letter (A, B, C...); null = straight sets. */
  supersetGroup: string | null;
  /** Position inside the superset (1, 2). */
  supersetOrder: number | null;
  notes: string | null;
};

export type ProgramSession = {
  id: EntityId;
  blockId: EntityId;
  /** 0 = Sunday .. 6 = Saturday. */
  dayOfWeek: number;
  sortOrder: number;
  sessionType: ProgramSessionType;
  name: string;
  upperTemplateId: EntityId | null;
  rideKind: RideKind | null;
  minutesMin: number | null;
  minutesMax: number | null;
  structure: string | null;
  gateKey: string | null;
  isOptional: boolean;
  notes: string | null;
  exercises: ProgramExercise[];
};

export type ProgramBlock = {
  id: EntityId;
  name: string;
  startWeek: number;
  endWeek: number;
  setsMin: number | null;
  setsMax: number | null;
  repsMin: number | null;
  repsMax: number | null;
  rirTarget: number | null;
  repScheme: string | null;
  /** A block with no sessions of its own runs this block's sessions. */
  sessionsFromBlockId: EntityId | null;
  activation: BlockActivation;
  /** activation "gate": the gate that opens the block. */
  gateKey: string | null;
  /** activation "gate": the block that runs until the gate clears. */
  fallbackBlockId: EntityId | null;
  /** activation "manual": runs from this date on. */
  activatedOn: IsoDate | null;
  notes: string | null;
};

export type ProgramWeek = {
  weekNumber: number;
  isDeload: boolean;
  notes: string | null;
};

export type ProgramGate = {
  id: EntityId;
  gateKey: string;
  label: string;
  /** Null until cleared; cleared from this date on. */
  clearedOn: IsoDate | null;
  /** Earliest expected clearance (display only). */
  earliestOn: IsoDate | null;
  notes: string | null;
};

export type TrainingProgram = {
  id: EntityId;
  userId: UserId;
  name: string;
  /** "program v1, 2026-10-19". */
  version: string | null;
  /** Week 0 starts on this date (the surgery date). */
  weekAnchorDate: IsoDate;
  returnToSportWeek: number | null;
  testDayUrl: string | null;
  notes: string | null;
  blocks: ProgramBlock[];
  weeks: ProgramWeek[];
  sessions: ProgramSession[];
  gates: ProgramGate[];
};

/** Morning knee check, stored on the day's recovery row. */
export type KneeSwelling = "none" | "trace" | "1+" | "2+";

export type KneeCheck = {
  swelling: KneeSwelling | null;
  graftPain: number | null;
  extensionFull: boolean | null;
};

/** normal: full session. hold: repeat loads. knee_off: leg block replaced. */
export type KneeReadinessStatus = "normal" | "hold" | "knee_off";

export type SessionOutcomeKind = "skipped" | "stopped";
export type SkipReason = "time" | "knee" | "sick" | "travel" | "other";
export type RedFlagReason = "giving_way" | "locking" | "sharp_pain";

/** An explicit skip (with a reason) or a red-flag stop for a planned session. */
export type ProgramSessionOutcome = {
  id: EntityId;
  programSessionId: EntityId;
  date: IsoDate;
  outcome: SessionOutcomeKind;
  reason: SkipReason | RedFlagReason;
  notes: string | null;
};

/** Manual weekly entries for the Sunday review (week_start = Monday). */
export type ProgramWeeklyCheckin = {
  weekStart: IsoDate;
  ptVisitsScheduled: number | null;
  ptVisitsAttended: number | null;
  quadLsiPct: number | null;
  walkingAsymmetryPct: number | null;
  notes: string | null;
};

/**
 * One measured knee value synced from the PT Tracker (knee_tests): a crane
 * trial, a hop, a tape reading. side L = operated knee, R = other, null when
 * the value has no side.
 */
export type KneeTest = {
  testDate: IsoDate;
  testType: string;
  side: "L" | "R" | null;
  value: number;
  unit: string;
  repIndex: number;
  source: string;
  notes: string | null;
};

/** One target or threshold row, edited in Settings. */
export type TrainingSetting = {
  id: EntityId;
  key: string;
  value: number | null;
  textValue: string | null;
  label: string;
  unit: string | null;
  groupName: string;
  sortOrder: number;
};
