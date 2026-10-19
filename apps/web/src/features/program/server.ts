import "server-only";

import {
  addDays,
  buildDayPlan,
  buildLiftLoggerPlan,
  exerciseProgress,
  getZonedDate,
  kneeReadinessStatus,
  lastSetsByExercise,
  legExerciseIndex,
  programMilestones,
  programWeekDates,
  programWeekInfo,
  sessionsForBlock,
  weekDateRange,
  weeklyHardLegSets,
  WEEKLY_HARD_LEG_SETS,
  type DayPlan,
  type UpperTemplateExercise,
} from "@fitness-app/application";
import {
  isStrengthTemplateDefinition,
  type KneeCheck,
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

async function zonedToday(userId: string) {
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
): ProgramSessionView[] {
  return plan.sessions.map((s) => ({
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
    exercises: s.exercises.map((p) => ({
      name: p.name,
      status: p.status,
      lockedReason: p.lockedReason,
      prescription: formatPrescription(p),
    })),
  }));
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

function buildToday(
  program: TrainingProgram,
  today: string,
  kneeCheck: KneeCheck | null,
  templates: TrainingTemplate[],
): { view: ProgramToday; plan: DayPlan } {
  const kneeStatus = kneeReadinessStatus(kneeCheck);
  const plan = buildDayPlan(program, today, kneeStatus);
  const sessions = sessionViews(plan, templates);
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
    },
  };
}

/** Today's program for the dashboard card. Null without an active program. */
export async function getProgramToday(): Promise<ProgramToday | null> {
  const user = await requireCurrentUser();
  const { programService, trainingTemplateService } =
    await createCoreServices();
  const today = await zonedToday(user.id);
  const [program, checks, templates] = await Promise.all([
    programService.getActiveProgram(user.id),
    programService.listKneeChecks(user.id, today, today),
    trainingTemplateService.listActiveStrengthTemplates({ userId: user.id }),
  ]);
  if (!program) return null;
  return buildToday(program, today, checks[0] ?? null, templates).view;
}

/**
 * Today's lift for /strength: the knee check state, and once it is in, the
 * combined legs + upper plan with suggested loads.
 */
export async function getStrengthProgramPlan(
  sessions: StrengthSession[],
  templates: TrainingTemplate[],
): Promise<StrengthProgramPlan | null> {
  const user = await requireCurrentUser();
  const { programService } = await createCoreServices();
  const today = await zonedToday(user.id);
  const [program, checks] = await Promise.all([
    programService.getActiveProgram(user.id),
    programService.listKneeChecks(user.id, today, today),
  ]);
  if (!program) return null;
  const { view, plan } = buildToday(
    program,
    today,
    checks[0] ?? null,
    templates,
  );
  const lift = plan.sessions.find(
    (s) => s.session.sessionType === "lift" && s.visible,
  );
  if (!lift) return null;
  return {
    today: view,
    plan:
      view.kneeStatus == null
        ? null
        : buildLiftLoggerPlan({
            program,
            planned: lift,
            info: plan.info,
            readiness: view.kneeStatus,
            history: lastSetsByExercise(sessions),
            upper: upperFor(templates, lift.session.upperTemplateId),
          }),
  };
}

export async function getProgramPageData(): Promise<ProgramPageData> {
  const user = await requireCurrentUser();
  const {
    programService,
    strengthService,
    cardioService,
    trainingTemplateService,
  } = await createCoreServices();
  const today = await zonedToday(user.id);
  const program = await programService.getActiveProgram(user.id);

  if (!program) {
    return {
      program: null,
      today: null,
      week: [],
      milestones: [],
      hardSets: [],
      hardSetTarget: WEEKLY_HARD_LEG_SETS,
      progress: [],
      gates: [],
    };
  }

  const weekDates = programWeekDates(program, today);
  const currentWeek = programWeekInfo(program, today).week;
  const firstHardSetWeek = Math.max(0, currentWeek - HARD_SET_WEEKS + 1);
  const historyStart = addDays(today, -HISTORY_DAYS);

  const [checks, sessions, rides, templates] = await Promise.all([
    programService.listKneeChecks(
      user.id,
      weekDates[0]!,
      weekDates[weekDates.length - 1]!,
    ),
    strengthService.listByDateRange({
      userId: user.id,
      startDate: historyStart,
      endDate: today,
      limit: 2000,
    }),
    cardioService.listByDateRange({
      userId: user.id,
      startDate: weekDates[0]!,
      endDate: weekDates[weekDates.length - 1]!,
    }),
    trainingTemplateService.listActiveStrengthTemplates({ userId: user.id }),
  ]);

  const checkOn = (date: string) => checks.find((c) => c.date === date) ?? null;
  const { view: todayView } = buildToday(
    program,
    today,
    checkOn(today),
    templates,
  );

  const liftDates = new Set(
    sessions.filter((s) => s.sets.length > 0).map((s) => s.sessionDate),
  );
  const rideDates = new Set(
    rides
      .filter((r) => r.plannedVsCompleted !== "skipped")
      .map((r) => r.sessionDate),
  );

  const week: ProgramWeekDay[] = weekDates.map((date) => {
    const kneeStatus = kneeReadinessStatus(checkOn(date));
    const plan = buildDayPlan(program, date, kneeStatus);
    return {
      date,
      dayOfWeek: plan.info.dayOfWeek,
      isToday: date === today,
      kneeStatus,
      sessions: sessionViews(plan, templates).map((s) => ({
        ...s,
        completion: sessionCompletion({
          type: s.type,
          date,
          today,
          liftDates,
          rideDates,
        }),
      })),
    };
  });

  const allExercises = program.sessions.flatMap((s) => s.exercises);
  const index = legExerciseIndex(allExercises);
  const hardSets = Array.from(
    { length: currentWeek - firstHardSetWeek + 1 },
    (_, i) => {
      const weekNumber = firstHardSetWeek + i;
      const range = weekDateRange(program.weekAnchorDate, weekNumber);
      return {
        week: weekNumber,
        start: range.start,
        count: weeklyHardLegSets(sessions, index, range),
      };
    },
  );

  // Loaded leg lifts and isometrics in the current block, in session order.
  const block = programWeekInfo(program, today).block;
  const seen = new Set<string>();
  const progress = (block ? sessionsForBlock(program, block) : [])
    .filter((s) => s.sessionType === "lift")
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .flatMap((s) => s.exercises)
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
    hardSetTarget: WEEKLY_HARD_LEG_SETS,
    progress,
    gates: program.gates,
  };
}

/** Gates for the Settings toggle list; empty without a program. */
export async function getProgramGates() {
  const user = await requireCurrentUser();
  const { programService } = await createCoreServices();
  const program = await programService.getActiveProgram(user.id);
  return program?.gates ?? [];
}
