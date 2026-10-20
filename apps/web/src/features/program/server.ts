import "server-only";

import {
  addDays,
  buildDayPlan,
  buildLiftLoggerPlan,
  countableSession,
  exerciseProgress,
  isScheduledSession,
  plannedZone2Minutes,
  getZonedDate,
  isGateCleared,
  kneeOffStreak,
  lastSetsByExercise,
  legExerciseIndex,
  programMilestones,
  programWeekDates,
  programWeekInfo,
  resolveProgram,
  isSettingGate,
  nextBlockStart,
  estimatePlannedSession,
  supersetLabel,
  sessionsForBlock,
  sleepAverageHours,
  walkJogAdvice,
  weekDateRange,
  weeklyHardLegSets,
  type DatedKneeCheck,
  type DayPlan,
  type ProgramSettings,
  type UpperTemplateExercise,
} from "@fitness-app/application";
import {
  isStrengthTemplateDefinition,
  type KneeReadinessStatus,
  type ProgramSessionOutcome,
  type StrengthSession,
  type TrainingProgram,
  type TrainingTemplate,
} from "@fitness-app/domain";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { formatPrescription, sessionCompletion } from "./helpers";
import type {
  ProgramHeader,
  ProgramPageData,
  ProgramSessionView,
  ProgramToday,
  ProgramWeekDay,
  StrengthProgramPlan,
} from "./types";

const HISTORY_DAYS = 730;
const HARD_SET_WEEKS = 6;
const PROGRESS_POINTS = 8;
/** Knee checks loaded for the streak and walk-jog rules. */
const CHECK_LOOKBACK_DAYS = 21;
const RUN_LOOKBACK_DAYS = 60;

export async function zonedToday(userId: string) {
  const profile = await getCachedUserProfile(userId);
  return getZonedDate(profile?.timezone || "UTC")
    .toISOString()
    .slice(0, 10);
}

function headerFor(program: TrainingProgram, date: string): ProgramHeader {
  const info = programWeekInfo(program, date);
  const next = nextBlockStart(program, date);
  return {
    nextBlock: next ? { name: next.label, date: next.date } : null,
    week: info.week,
    blockName: info.block?.name ?? null,
    repScheme: info.block?.repScheme ?? null,
    isDeload: info.isDeload,
    weekStart: info.weekStart,
    weekEnd: info.weekEnd,
  };
}

function sessionViews(
  plan: DayPlan,
  ctx: Pick<
    ProgramContext,
    "templates" | "outcomes" | "settings" | "today" | "liftDates" | "rideDates"
  >,
): ProgramSessionView[] {
  const { templates, outcomes, settings } = ctx;
  return plan.sessions.map((s) => {
    const estimate = estimatePlannedSession(s, settings);
    const outcome = outcomes.find(
      (o) => o.programSessionId === s.session.id && o.date === plan.date,
    );
    const countable = countableSession(s);
    return {
      id: s.session.id,
      type: s.session.sessionType,
      name: s.session.name,
      visible: s.visible,
      hiddenReason: s.hiddenReason,
      legBlockReplaced: s.legBlockReplaced,
      ride: s.ride,
      scheduled: isScheduledSession(countable),
      zone2Minutes: plannedZone2Minutes(countable),
      structure: s.ride ? null : s.session.structure,
      isOptional: s.session.isOptional,
      notes: s.session.notes,
      upperTemplateName:
        templates.find((t) => t.id === s.session.upperTemplateId)?.name ?? null,
      estimatedMinutes: estimate?.minutes ?? null,
      overBudget: estimate?.overBudget ?? false,
      outcome: outcome
        ? { outcome: outcome.outcome, reason: outcome.reason }
        : null,
      completion: sessionCompletion({
        type: s.session.sessionType,
        date: plan.date,
        today: ctx.today,
        liftDates: ctx.liftDates,
        rideDates: ctx.rideDates,
        outcome: outcome?.outcome ?? null,
      }),
      exercises: s.exercises.map((p) => ({
        name: p.name,
        part: p.part,
        status: p.status,
        lockedReason: p.lockedReason,
        prescription: formatPrescription(p),
        cue: p.exercise.cue,
        superset: supersetLabel(p.exercise),
      })),
    };
  });
}

function upperFor(
  templates: TrainingTemplate[],
  templateId: string | null,
): { notes: string | null; exercises: UpperTemplateExercise[] } | null {
  const template = templates.find((t) => t.id === templateId);
  if (!template || !isStrengthTemplateDefinition(template.definition)) {
    return null;
  }
  return {
    notes: template.definition.notes ?? null,
    exercises: template.definition.exercises.map((ex) => ({
      exerciseName: ex.exerciseName,
      exerciseOrder: ex.exerciseOrder,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      targetWeight: ex.targetWeight,
      targetRir: ex.targetRir,
      notes: ex.notes,
    })),
  };
}

export type ProgramContext = {
  program: TrainingProgram;
  settings: ProgramSettings;
  today: string;
  checks: DatedKneeCheck[];
  statusOn: (date: string) => KneeReadinessStatus | null;
  outcomes: ProgramSessionOutcome[];
  sleepAverage: number | null;
  templates: TrainingTemplate[];
  runs: { date: string; runMinutes: number }[];
  /** Days with a logged lift (any sets), and with a completed ride. */
  liftDates: Set<string>;
  rideDates: Set<string>;
  /** Latest logged strength session per day, for "View". */
  liftIdByDate: Map<string, string>;
};

/** Everything the program screens share; null without an active program. */
export async function loadProgramContext(
  extraOutcomeStart?: string,
): Promise<ProgramContext | null> {
  const user = await requireCurrentUser();
  const {
    programService,
    trainingTemplateService,
    recoveryService,
    cardioService,
    strengthService,
  } = await createCoreServices();
  const today = await zonedToday(user.id);
  const loaded = await programService.getActiveProgram(user.id);
  if (!loaded) return null;

  const outcomeStart = extraOutcomeStart ?? today;
  const [settingRows, checks, outcomes, recovery, templates, rides, lifts] =
    await Promise.all([
      programService.listSettings(user.id),
      programService.listKneeChecks(
        user.id,
        addDays(today, -CHECK_LOOKBACK_DAYS),
        addDays(today, 7),
      ),
      programService.listOutcomes(
        user.id,
        outcomeStart < today ? outcomeStart : today,
        addDays(today, 7),
      ),
      recoveryService.listByDateRange({
        userId: user.id,
        startDate: addDays(today, -7),
        endDate: today,
      }),
      trainingTemplateService.listActiveStrengthTemplates({ userId: user.id }),
      cardioService.listByDateRange({
        userId: user.id,
        startDate: addDays(today, -RUN_LOOKBACK_DAYS),
        endDate: today,
      }),
      // The program week holding today starts at most 6 days back.
      strengthService.listByDateRange({
        userId: user.id,
        startDate: addDays(outcomeStart < today ? outcomeStart : today, -7),
        endDate: today,
      }),
    ]);
  const logged = lifts
    .filter((l) => l.sets.length > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const { program, settings, statusOn } = resolveProgram(
    loaded,
    settingRows,
    checks,
  );

  return {
    program,
    settings,
    today,
    checks,
    statusOn,
    outcomes,
    sleepAverage: sleepAverageHours(
      recovery,
      today,
      settings.sleepAverageNights,
    ),
    templates,
    liftDates: new Set(logged.map((l) => l.sessionDate)),
    // Same rule as the dashboard plan: a completed ride, not a planned row
    // or an "other" activity.
    rideDates: new Set(
      rides
        .filter(
          (r) =>
            r.plannedVsCompleted === "completed" && r.sessionKind !== "other",
        )
        .map((r) => r.sessionDate),
    ),
    liftIdByDate: new Map(logged.map((l) => [l.sessionDate, l.id])),
    runs: rides
      .filter((r) => r.runMinutes != null && r.runMinutes > 0)
      .map((r) => ({
        date: r.sessionDate,
        runMinutes: r.runMinutes as number,
        walkMinutes: r.walkMinutes ?? null,
      })),
  };
}

function buildToday(ctx: ProgramContext): {
  view: ProgramToday;
  plan: DayPlan;
} {
  const { program, today, settings } = ctx;
  const kneeCheck = ctx.checks.find((c) => c.date === today) ?? null;
  const kneeStatus = ctx.statusOn(today);
  const plan = buildDayPlan(program, today, kneeStatus, settings);
  const sessions = sessionViews(plan, ctx);
  const streak = kneeOffStreak(
    ctx.checks.map((c) => ({ date: c.date, status: ctx.statusOn(c.date) })),
    today,
  );
  const jogCleared = isGateCleared(program.gates, "jog", today);
  return {
    plan,
    view: {
      today,
      header: headerFor(program, today),
      kneeCheck,
      kneeStatus,
      sessions,
      hasLift: sessions.some((s) => s.type === "lift" && s.visible),
      testDayUrl: program.testDayUrl,
      kneeOffStreak: streak,
      showGoBackWeek: streak >= settings.kneeOffStreakDays,
      redFlag: { name: settings.orthoName, phone: settings.orthoPhone },
      sleepAverageHours: ctx.sleepAverage,
      sleepMinHours: settings.sleepMinHoursForIncrease,
      walkJog: jogCleared
        ? walkJogAdvice({
            runs: ctx.runs,
            checks: ctx.checks.map((c) => ({
              date: c.date,
              status: ctx.statusOn(c.date),
            })),
            today,
            settings,
          })
        : null,
      warmUp: settings.warmUp || null,
      gaitDrill: settings.gaitDrill || null,
      loggedLiftId: ctx.liftIdByDate.get(today) ?? null,
      week: buildWeek(ctx),
    },
  };
}

/** The program week holding today, each session with its completion. */
function buildWeek(ctx: ProgramContext): ProgramWeekDay[] {
  const { program, today, settings } = ctx;
  return programWeekDates(program, today).map((date) => {
    const kneeStatus = ctx.statusOn(date);
    const plan = buildDayPlan(program, date, kneeStatus, settings);
    return {
      date,
      dayOfWeek: plan.info.dayOfWeek,
      isToday: date === today,
      kneeStatus,
      sessions: sessionViews(plan, ctx),
    };
  });
}

/** Today's program for the dashboard card. Null without an active program. */
export async function getProgramToday(): Promise<ProgramToday | null> {
  const ctx = await loadProgramContext();
  return ctx ? buildToday(ctx).view : null;
}

/**
 * Today's lift for /strength: the knee check state, and once it is in, the
 * combined plan with suggested leg loads.
 */
export async function getStrengthProgramPlan(
  sessions: StrengthSession[],
): Promise<StrengthProgramPlan | null> {
  const ctx = await loadProgramContext();
  if (!ctx) return null;
  const { view, plan } = buildToday(ctx);
  const lift = plan.sessions.find(
    (s) => s.session.sessionType === "lift" && s.visible,
  );
  if (!lift) return null;
  return {
    today: view,
    sessionId: lift.session.id,
    plan:
      view.kneeStatus == null
        ? null
        : buildLiftLoggerPlan({
            program: ctx.program,
            planned: lift,
            info: plan.info,
            readiness: view.kneeStatus,
            history: lastSetsByExercise(sessions),
            upper: upperFor(ctx.templates, lift.session.upperTemplateId),
            sleepAverageHours: ctx.sleepAverage,
            settings: ctx.settings,
          }),
  };
}

export async function getProgramPageData(): Promise<ProgramPageData> {
  const user = await requireCurrentUser();
  const { strengthService } = await createCoreServices();
  const firstToday = await zonedToday(user.id);
  const ctx = await loadProgramContext(addDays(firstToday, -7));

  if (!ctx) {
    return {
      program: null,
      today: null,
      week: [],
      milestones: [],
      hardSets: [],
      hardSetTarget: { min: 12, max: 16 },
      progress: [],
      gates: [],
    };
  }

  const { program, today, settings } = ctx;
  const currentWeek = programWeekInfo(program, today).week;
  const firstProgramWeek = Math.min(...program.blocks.map((b) => b.startWeek));
  const firstHardSetWeek = Math.max(
    firstProgramWeek,
    currentWeek - HARD_SET_WEEKS + 1,
  );

  const sessions = await strengthService.listByDateRange({
    userId: user.id,
    startDate: addDays(today, -HISTORY_DAYS),
    endDate: today,
    limit: 2000,
  });

  const { view: todayView } = buildToday(ctx);

  const index = legExerciseIndex(
    program.sessions
      .flatMap((s) => s.exercises)
      .filter((e) => e.blockPart === "legs"),
  );
  const hardSets = Array.from(
    { length: currentWeek - firstHardSetWeek + 1 },
    (_, i) => {
      const weekNumber = firstHardSetWeek + i;
      const range = weekDateRange(program.weekAnchorDate, weekNumber);
      return {
        week: weekNumber,
        start: range.start,
        count: weeklyHardLegSets(
          sessions,
          index,
          range,
          settings.hardSetMaxRir,
        ),
      };
    },
  );

  // Loaded leg lifts and isometrics in the current block, in session order.
  const block = programWeekInfo(program, today).block;
  const seen = new Set<string>();
  const progress = (block ? sessionsForBlock(program, block) : [])
    .filter((s) => s.sessionType === "lift")
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .flatMap((s) => s.exercises.filter((e) => e.blockPart === "legs"))
    .flatMap((ex) =>
      [ex.name, ex.substituteName]
        .filter((n): n is string => n != null)
        .map((name) => ({ name, ex })),
    )
    .filter(({ name, ex }) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return ex.measure === "force" || ex.loadKind !== "bodyweight";
    })
    .map(({ name, ex }) => ({
      name,
      perLeg: ex.sideMode === "per_leg",
      force: ex.measure === "force",
      points: exerciseProgress(sessions, name).slice(-PROGRESS_POINTS),
    }))
    .filter((p) => p.points.length > 0);

  return {
    program: {
      name: program.name,
      version: program.version,
      testDayUrl: program.testDayUrl,
      rules: settings.programRules
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean),
    },
    today: todayView,
    week: todayView.week,
    milestones: programMilestones(program).map((m) => ({
      ...m,
      past: m.date <= today,
    })),
    hardSets,
    hardSetTarget: { min: settings.quadSetsMin, max: settings.quadSetsMax },
    progress,
    gates: program.gates,
  };
}

/** Gates and settings rows for the Settings page; empty without a program. */
export async function getProgramSettingsData() {
  const user = await requireCurrentUser();
  const { programService } = await createCoreServices();
  const [program, settings] = await Promise.all([
    programService.getActiveProgram(user.id),
    programService.listSettings(user.id),
  ]);
  return {
    gates: (program?.gates ?? []).filter((g) => !isSettingGate(g.gateKey)),
    settings,
  };
}
