import type {
  FocusMetric,
  LiftWeekProgress,
  NutritionWeek,
  ReadinessCounts,
  SleepWeek,
  WeekAdherence,
  WalkJogAdvice,
  QuadDrop,
  KneeTestSummary,
  ExerciseProgressPoint,
  HardSetCount,
  LoggerPlan,
  PlannedExerciseStatus,
  PlannedRide,
  ProgramMilestone,
} from "@fitness-app/application";
import type {
  BlockPart,
  KneeCheck,
  KneeReadinessStatus,
  ProgramGate,
  ProgramSessionOutcome,
  ProgramSessionType,
  ProgramWeeklyCheckin,
} from "@fitness-app/domain";
import type { SessionCompletion } from "./helpers";

export type ProgramExerciseView = {
  name: string;
  part: BlockPart;
  status: PlannedExerciseStatus;
  lockedReason: string | null;
  /** "3 x 10–12 @ RIR 2", "3 x 20 s per leg", "5 x 5 s, peak N per leg". */
  prescription: string;
  /** One-line coaching cue. */
  cue: string | null;
  /** "A1", "A2"; null for straight sets. */
  superset: string | null;
};

export type ProgramSessionView = {
  id: string;
  type: ProgramSessionType;
  name: string;
  visible: boolean;
  hiddenReason: string | null;
  legBlockReplaced: boolean;
  ride: PlannedRide | null;
  /**
   * Counts toward the week's scheduled lifts and rides, and the Zone 2
   * minutes it adds to the week's target. Set on the server from the shared
   * program-week rules (`isScheduledSession`, `plannedZone2Minutes`), so the
   * dashboard and the weekly review count the same way.
   */
  scheduled: boolean;
  zone2Minutes: number | null;
  exercises: ProgramExerciseView[];
  upperTemplateName: string | null;
  /** Session structure (test day, golf, runs); rides use `ride`. */
  structure: string | null;
  isOptional: boolean;
  notes: string | null;
  /** Estimated minutes as it runs today; null when there is nothing to time. */
  estimatedMinutes: number | null;
  /** Lift session over the time limit (60 min). */
  overBudget: boolean;
  /** An explicit skip or red-flag stop logged for this date. */
  outcome: Pick<ProgramSessionOutcome, "outcome" | "reason"> | null;
  /** Done once logged (lifts and rides), else missed/today/planned. */
  completion: SessionCompletion;
  /** Done by a lift logged on this later date (a make-up). */
  madeUpOn: string | null;
  /** Set on an earlier missed/skipped lift this week that can be made up today. */
  makeUp: { href: string; warning: string | null } | null;
};

export type ProgramHeader = {
  week: number;
  /** The next block and its first day. */
  nextBlock: { name: string; date: string } | null;
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
  kneeOffStreak: number;
  /** Knee-off streak at the setting: "go back one week on leg loads". */
  showGoBackWeek: boolean;
  redFlag: { name: string; phone: string | null };
  sleepAverageHours: number | null;
  sleepMinHours: number;
  /** Left quad crane-test drop past the setting: leg loads held. */
  quadDrop: QuadDrop | null;
  /** Next walk-jog, once the jog gate is cleared. */
  walkJog: WalkJogAdvice | null;
  /** Lift-day warm-up, items separated by "; ". */
  warmUp: string | null;
  gaitDrill: string | null;
  /** Today's logged strength session, for the "View" link once done. */
  loggedLiftId: string | null;
  /** The most recent lift this week that can be made up today. */
  makeUp: {
    sessionId: string;
    date: string;
    name: string;
    href: string;
    warning: string | null;
  } | null;
  /** The program week holding today, Monday to Sunday. */
  week: ProgramWeekDay[];
};

export type ProgramWeekDay = {
  date: string;
  dayOfWeek: number;
  isToday: boolean;
  kneeStatus: KneeReadinessStatus | null;
  sessions: ProgramSessionView[];
};

export type ExerciseProgressView = {
  name: string;
  perLeg: boolean;
  force: boolean;
  points: ExerciseProgressPoint[];
};

export type ProgramPageData = {
  program: {
    name: string;
    version: string | null;
    testDayUrl: string | null;
    /** The program's global rules, one per line. */
    rules: string[];
  } | null;
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
  /** Today's lift session, or the missed one being made up (skip, red flag and the saved lift's link). */
  sessionId: string;
  /** Making up a missed lift: its scheduled date and name; null for today's lift. */
  makeUp: { date: string; name: string; warning: string | null } | null;
  /** Null until the knee check is in, or when today has no lift. */
  plan: LoggerPlan | null;
};

export type ProgramActionState = {
  saved?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type AdherenceSnapshot = {
  adherence: WeekAdherence;
  liftStreakWeeks: number;
  romStreakDays: number;
  /** Leg sessions short two completed weeks running. */
  executionBanner: boolean;
  /** 7-day weight average rising too fast. */
  surplusBanner: boolean;
  waistDue: boolean;
  lastWaistOn: string | null;
};

export type WeeklyReviewData = {
  week: number;
  currentWeek: number;
  firstWeek: number;
  weekStart: string;
  weekEnd: string;
  blockName: string | null;
  nextBlock: { name: string; date: string } | null;
  adherence: WeekAdherence;
  liftStreakWeeks: number;
  romStreakDays: number;
  readiness: ReadinessCounts;
  lifts: LiftWeekProgress[];
  quadSets: { done: number; min: number; max: number };
  nutrition: NutritionWeek;
  weight: { sevenDayAvgLb: number | null; weekOverWeekLb: number | null };
  sleep: SleepWeek;
  quadLsiPct: number | null;
  walkingAsymmetryPct: number | null;
  focus: FocusMetric | null;
  checkin: ProgramWeeklyCheckin | null;
  trend: {
    week: number;
    quadLsiPct: number | null;
    walkingAsymmetryPct: number | null;
  }[];
  /** PT Tracker knee tests as of the week's end (quad LSI 90° / 60°, H:Q, walking, the quad-drop hold). */
  knee: KneeTestSummary;
  /** Newest synced crane test, any week; null until the PT Tracker has synced. */
  kneeAsOf: string | null;
  targets: {
    lsi: number[];
    asymmetry: number;
    sleepH: number;
    proteinFlagG: number;
  };
  surplusBanner: boolean;
  summaryText: string;
};
