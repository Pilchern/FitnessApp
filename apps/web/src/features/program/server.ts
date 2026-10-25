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
  leftQuadDrop,
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
  type QuadDrop,
  type UpperTemplateExercise,
} from "@fitness-app/application";
import {
  isStrengthTemplateDefinition,
  type KneeReadinessStatus,
  type ProgramMakeUp,
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
import {
  applyRideMakeUps,
  formatPrescription,
  linkedLiftFor,
  makeUpCall,
  makeUpHref,
  sessionCompletion,
  splitLoggedLifts,
  type LinkedLift,
} from "./helpers";
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
/** Two crane tests at most 14 days stale need about a month of rows. */
const KNEE_TEST_LOOKBACK_DAYS = 35;

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
    | "templates"
    | "outcomes"
    | "settings"
    | "today"
    | "liftDates"
    | "linkedLifts"
    | "rideDates"
    | "rawRideDates"
    | "makeUps"
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
      name: s.name,
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
        sessionId: s.session.id,
        linkedLifts: ctx.linkedLifts,
      }),
      madeUpOn: madeUpOn(ctx, s.session, plan.date),
      rideMakeUpPending: rideMakeUpPending(ctx, s.session, plan.date),
      makeUp: null,
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

function rideMakeUpFor(
  ctx: Pick<ProgramContext, "makeUps">,
  sessionId: string,
  date: string,
) {
  return (
    ctx.makeUps.find(
      (m) => m.programSessionId === sessionId && m.scheduledDate === date,
    ) ?? null
  );
}

/**
 * The later day this session was made up on: a linked lift dated after it,
 * or a ride make-up with a ride that day. Else null.
 */
function madeUpOn(
  ctx: Pick<ProgramContext, "linkedLifts" | "makeUps" | "rawRideDates">,
  session: { id: string; sessionType: string },
  date: string,
) {
  if (session.sessionType === "peloton") {
    const m = rideMakeUpFor(ctx, session.id, date);
    return m && ctx.rawRideDates.has(m.madeUpOn) ? m.madeUpOn : null;
  }
  const linked = linkedLiftFor(ctx.linkedLifts, session.id, date);
  return linked && linked.date > date ? linked.date : null;
}

/** A ride make-up set for a day with no ride (yet): that day, else null. */
function rideMakeUpPending(
  ctx: Pick<ProgramContext, "makeUps" | "rawRideDates">,
  session: { id: string; sessionType: string },
  date: string,
) {
  if (session.sessionType !== "peloton") return null;
  const m = rideMakeUpFor(ctx, session.id, date);
  return m && !ctx.rawRideDates.has(m.madeUpOn) ? m.madeUpOn : null;
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
  /** Left quad crane-test drop past the setting (PT Tracker); holds leg loads. */
  quadDrop: QuadDrop | null;
  templates: TrainingTemplate[];
  runs: { date: string; runMinutes: number }[];
  /**
   * Days with a logged lift (any sets) not linked to a program session, and
   * with a completed ride.
   */
  liftDates: Set<string>;
  rideDates: Set<string>;
  /** Ride days as logged, before make-ups move a ride to its scheduled day. */
  rawRideDates: Set<string>;
  /** Ride make-ups for the last two weeks. */
  makeUps: ProgramMakeUp[];
  /** Logged lifts linked to the program session they fulfil. */
  linkedLifts: LinkedLift[];
  /** Latest unlinked strength session per day, for "View". */
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
  const [
    settingRows,
    checks,
    outcomes,
    recovery,
    templates,
    rides,
    lifts,
    kneeTests,
    makeUps,
  ] = await Promise.all([
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
    programService.listKneeTests(
      user.id,
      addDays(today, -KNEE_TEST_LOOKBACK_DAYS),
      today,
    ),
    programService.listMakeUps(user.id, addDays(today, -13), today),
  ]);
  // Same rule as the dashboard plan: a completed ride, not a planned row or
  // an "other" activity.
  const rawRideDates = new Set(
    rides
      .filter(
        (r) =>
          r.plannedVsCompleted === "completed" && r.sessionKind !== "other",
      )
      .map((r) => r.sessionDate),
  );
  const logged = lifts
    .filter((l) => l.sets.length > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const { program, settings, statusOn } = resolveProgram(
    loaded,
    settingRows,
    checks,
  );
  const { liftDates, liftIdByDate, linkedLifts } = splitLoggedLifts(
    logged,
    new Set(loaded.sessions.map((s) => s.id)),
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
    quadDrop: leftQuadDrop(kneeTests, today, settings.quadDropHoldN),
    templates,
    liftDates,
    linkedLifts,
    rawRideDates,
    makeUps,
    rideDates: applyRideMakeUps(rawRideDates, makeUps),
    liftIdByDate,
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
  const week = buildWeek(ctx);
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
      quadDrop: ctx.quadDrop,
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
      // The lift linked to today's lift session first, else today's unlinked one.
      makeUps: todayMakeUps(week),
      loggedLiftId:
        plan.sessions
          .filter((s) => s.session.sessionType === "lift")
          .map((s) => linkedLiftFor(ctx.linkedLifts, s.session.id, today)?.id)
          .find((id) => id != null) ??
        ctx.liftIdByDate.get(today) ??
        null,
      week,
    },
  };
}

function hasVisible(plan: DayPlan, type: "lift" | "peloton") {
  return plan.sessions.some((s) => s.session.sessionType === type && s.visible);
}

/**
 * The program week holding today, each session with its completion, and a
 * make-up link on earlier missed or skipped lifts that can be done today.
 */
function buildWeek(ctx: ProgramContext): ProgramWeekDay[] {
  const { program, today, settings } = ctx;
  const dates = programWeekDates(program, today);
  const tomorrow = addDays(today, 1);
  const days = dates.map((date) => {
    const kneeStatus = ctx.statusOn(date);
    const plan = buildDayPlan(program, date, kneeStatus, settings);
    return { date, kneeStatus, plan };
  });
  const todayPlan = days.find((d) => d.date === today)?.plan;
  const tomorrowPlan = buildDayPlan(
    program,
    tomorrow,
    ctx.statusOn(tomorrow),
    settings,
  );
  const byType = {
    lift: {
      todayHasOwn: todayPlan ? hasVisible(todayPlan, "lift") : false,
      alreadyToday:
        ctx.liftDates.has(today) ||
        ctx.linkedLifts.some((l) => l.date === today),
      nextTomorrow: hasVisible(tomorrowPlan, "lift"),
    },
    peloton: {
      todayHasOwn: todayPlan ? hasVisible(todayPlan, "peloton") : false,
      alreadyToday: ctx.makeUps.some((m) => m.madeUpOn === today),
      nextTomorrow: hasVisible(tomorrowPlan, "peloton"),
    },
  };
  return days.map(({ date, kneeStatus, plan }) => ({
    date,
    dayOfWeek: plan.info.dayOfWeek,
    isToday: date === today,
    kneeStatus,
    sessions: sessionViews(plan, ctx).map((view) => {
      if (!view.visible) return view;
      if (view.type !== "lift" && view.type !== "peloton") return view;
      const call = makeUpCall({
        type: view.type,
        completion: view.completion,
        date,
        today,
        weekStart: dates[0] ?? today,
        ...byType[view.type],
      });
      if (!call.eligible) return view;
      return {
        ...view,
        makeUp:
          view.type === "lift"
            ? {
                kind: "lift" as const,
                href: makeUpHref(view.id, date),
                warning: call.warning,
              }
            : { kind: "ride" as const, href: null, warning: call.warning },
      };
    }),
  }));
}

/**
 * Make-ups for the Today card, newest first: the latest lift and the latest
 * ride that can be made up today, and any ride make-up already set for today.
 */
function todayMakeUps(week: ProgramWeekDay[]): ProgramToday["makeUps"] {
  const out: ProgramToday["makeUps"] = [];
  const seen = new Set<string>();
  for (const day of [...week].reverse()) {
    for (const s of day.sessions) {
      if (s.rideMakeUpPending) {
        out.push({
          kind: "ride",
          sessionId: s.id,
          date: day.date,
          name: s.name,
          href: null,
          warning: null,
          pendingOn: s.rideMakeUpPending,
        });
        seen.add("ride");
      } else if (s.makeUp && !seen.has(s.makeUp.kind)) {
        out.push({
          kind: s.makeUp.kind,
          sessionId: s.id,
          date: day.date,
          name: s.name,
          href: s.makeUp.href,
          warning: s.makeUp.warning,
          pendingOn: null,
        });
        seen.add(s.makeUp.kind);
      }
    }
  }
  return out;
}

/** Today's program for the dashboard card. Null without an active program. */
export async function getProgramToday(): Promise<ProgramToday | null> {
  const ctx = await loadProgramContext();
  return ctx ? buildToday(ctx).view : null;
}

/**
 * Today's lift for /strength: the knee check state, and once it is in, the
 * combined plan with suggested leg loads. With `makeUp` (a session id and its
 * scheduled date) it loads that missed lift instead, when it is still
 * eligible (see makeUpCall); the saved lift links to it, which marks that
 * day done. Today's knee check gates both.
 */
export async function getStrengthProgramPlan(
  sessions: StrengthSession[],
  makeUp?: { sessionId: string; date: string } | null,
): Promise<StrengthProgramPlan | null> {
  const ctx = await loadProgramContext();
  if (!ctx) return null;
  const { view, plan } = buildToday(ctx);
  const target = makeUp
    ? view.week
        .find((d) => d.date === makeUp.date)
        ?.sessions.find((s) => s.id === makeUp.sessionId && s.makeUp)
    : null;
  const sourcePlan = target
    ? buildDayPlan(ctx.program, makeUp!.date, view.kneeStatus, ctx.settings)
    : plan;
  const lift = target
    ? sourcePlan.sessions.find((s) => s.session.id === target.id)
    : plan.sessions.find((s) => s.session.sessionType === "lift" && s.visible);
  if (!lift) return null;
  const loggerPlan =
    view.kneeStatus == null
      ? null
      : buildLiftLoggerPlan({
          program: ctx.program,
          planned: lift,
          info: sourcePlan.info,
          readiness: view.kneeStatus,
          history: lastSetsByExercise(sessions),
          upper: upperFor(ctx.templates, lift.session.upperTemplateId),
          sleepAverageHours: ctx.sleepAverage,
          quadDrop: ctx.quadDrop,
          settings: ctx.settings,
        });
  return {
    today: view,
    sessionId: lift.session.id,
    makeUp: target
      ? {
          date: makeUp!.date,
          name: target.name,
          warning: target.makeUp?.warning ?? null,
        }
      : null,
    plan:
      loggerPlan && target
        ? {
            ...loggerPlan,
            notes: [
              `Make-up for ${target.name}, scheduled ${makeUp!.date}.`,
              loggerPlan.notes,
            ]
              .filter(Boolean)
              .join("\n\n"),
          }
        : loggerPlan,
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
