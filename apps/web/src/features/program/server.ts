import "server-only";

import {
  addDays,
  buildDayPlan,
  buildLiftLoggerPlan,
  exerciseProgress,
  getZonedDate,
  isGateCleared,
  kneeOffStreak,
  kneeReadinessStatus,
  lastSetsByExercise,
  legExerciseIndex,
  programMilestones,
  programSettingsFromRows,
  programWeekDates,
  programWeekInfo,
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
  return {
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
  templates: TrainingTemplate[],
  outcomes: ProgramSessionOutcome[],
): ProgramSessionView[] {
  return plan.sessions.map((s) => {
    const outcome = outcomes.find(
      (o) => o.programSessionId === s.session.id && o.date === plan.date,
    );
    return {
      id: s.session.id,
      type: s.session.sessionType,
      name: s.session.name,
      visible: s.visible,
      hiddenReason: s.hiddenReason,
      legBlockReplaced: s.legBlockReplaced,
      ride: s.ride,
      notes: s.session.notes,
      upperTemplateName:
        templates.find((t) => t.id === s.session.upperTemplateId)?.name ?? null,
      outcome: outcome
        ? { outcome: outcome.outcome, reason: outcome.reason }
        : null,
      exercises: s.exercises.map((p) => ({
        name: p.name,
        part: p.part,
        status: p.status,
        lockedReason: p.lockedReason,
        prescription: formatPrescription(p),
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
  } = await createCoreServices();
  const today = await zonedToday(user.id);
  const program = await programService.getActiveProgram(user.id);
  if (!program) return null;

  const outcomeStart = extraOutcomeStart ?? today;
  const [settingRows, checks, outcomes, recovery, templates, rides] =
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
    ]);
  const settings = programSettingsFromRows(settingRows);
  const statusOn = (date: string) =>
    kneeReadinessStatus(checks.find((c) => c.date === date) ?? null, settings);

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
    runs: rides
      .filter((r) => r.runMinutes != null && r.runMinutes > 0)
      .map((r) => ({
        date: r.sessionDate,
        runMinutes: r.runMinutes as number,
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
  const sessions = sessionViews(plan, ctx.templates, ctx.outcomes);
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
    },
  };
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
  const { strengthService, cardioService } = await createCoreServices();
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
  const weekDates = programWeekDates(program, today);
  const currentWeek = programWeekInfo(program, today).week;
  const firstHardSetWeek = Math.max(0, currentWeek - HARD_SET_WEEKS + 1);

  const [sessions, rides] = await Promise.all([
    strengthService.listByDateRange({
      userId: user.id,
      startDate: addDays(today, -HISTORY_DAYS),
      endDate: today,
      limit: 2000,
    }),
    cardioService.listByDateRange({
      userId: user.id,
      startDate: weekDates[0]!,
      endDate: weekDates[weekDates.length - 1]!,
    }),
  ]);

  const { view: todayView } = buildToday(ctx);
  const liftDates = new Set(
    sessions.filter((s) => s.sets.length > 0).map((s) => s.sessionDate),
  );
  const rideDates = new Set(
    rides
      .filter((r) => r.plannedVsCompleted !== "skipped")
      .map((r) => r.sessionDate),
  );

  const week: ProgramWeekDay[] = weekDates.map((date) => {
    const kneeStatus = ctx.statusOn(date);
    const plan = buildDayPlan(program, date, kneeStatus, settings);
    return {
      date,
      dayOfWeek: plan.info.dayOfWeek,
      isToday: date === today,
      kneeStatus,
      sessions: sessionViews(plan, ctx.templates, ctx.outcomes).map((s) => ({
        ...s,
        completion: sessionCompletion({
          type: s.type,
          date,
          today,
          liftDates,
          rideDates,
          outcome: s.outcome?.outcome ?? null,
        }),
      })),
    };
  });

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
    program: { name: program.name, testDayUrl: program.testDayUrl },
    today: todayView,
    week,
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
  return { gates: program?.gates ?? [], settings };
}
