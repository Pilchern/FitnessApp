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
  | "walk_jog";

export type RideKind = "zone2" | "climb_intervals";
export type ExerciseMeasure = "reps" | "time" | "force";
export type SideMode = "bilateral" | "per_leg";
export type LoadKind = "barbell" | "dumbbell" | "cuff" | "bodyweight" | "band";
export type ReadinessRequirement = "any" | "normal";
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
  tempo: string | null;
  gateKey: string | null;
  substituteName: string | null;
  substituteLoadKind: LoadKind | null;
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
  notes: string | null;
};

export type TrainingProgram = {
  id: EntityId;
  userId: UserId;
  name: string;
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
