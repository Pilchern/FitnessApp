import type {
  ExerciseProgressPoint,
  HardSetCount,
  LoggerPlan,
  PlannedExerciseStatus,
  PlannedRide,
  ProgramMilestone,
} from "@fitness-app/application";
import type {
  KneeCheck,
  KneeReadinessStatus,
  ProgramGate,
  ProgramSessionType,
} from "@fitness-app/domain";
import type { SessionCompletion } from "./helpers";

export type ProgramExerciseView = {
  name: string;
  status: PlannedExerciseStatus;
  lockedReason: string | null;
  /** "3 x 10–12 @ RIR 2", "3 x 20 s per leg", "5 x 5 s, peak N per leg". */
  prescription: string;
};

export type ProgramSessionView = {
  id: string;
  type: ProgramSessionType;
  name: string;
  visible: boolean;
  hiddenReason: string | null;
  legBlockReplaced: boolean;
  ride: PlannedRide | null;
  exercises: ProgramExerciseView[];
  upperTemplateName: string | null;
  notes: string | null;
};

export type ProgramHeader = {
  week: number;
  blockName: string | null;
  repScheme: string | null;
  isDeload: boolean;
  weekStart: string;
  weekEnd: string;
};

export type ProgramToday = {
  today: string;
  header: ProgramHeader;
  kneeCheck: KneeCheck | null;
  kneeStatus: KneeReadinessStatus | null;
  sessions: ProgramSessionView[];
  hasLift: boolean;
  testDayUrl: string | null;
};

export type ProgramWeekDay = {
  date: string;
  dayOfWeek: number;
  isToday: boolean;
  kneeStatus: KneeReadinessStatus | null;
  sessions: (ProgramSessionView & { completion: SessionCompletion })[];
};

export type ExerciseProgressView = {
  name: string;
  perLeg: boolean;
  force: boolean;
  points: ExerciseProgressPoint[];
};

export type ProgramPageData = {
  program: { name: string; testDayUrl: string | null } | null;
  today: ProgramToday | null;
  week: ProgramWeekDay[];
  milestones: (ProgramMilestone & { past: boolean })[];
  hardSets: { week: number; start: string; count: HardSetCount }[];
  hardSetTarget: { min: number; max: number };
  progress: ExerciseProgressView[];
  gates: ProgramGate[];
};

export type StrengthProgramPlan = {
  today: ProgramToday;
  /** Null until the knee check is in, or when today has no lift. */
  plan: LoggerPlan | null;
};

export type ProgramActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};
