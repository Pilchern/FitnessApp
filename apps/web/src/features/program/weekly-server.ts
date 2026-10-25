import "server-only";

import {
  addDays,
  buildDayPlan,
  buildWeeklyWeightTrend,
  countLifts,
  dayStreak,
  executionBanner,
  kneeReadinessStatus,
  kneeTestSummary,
  latestValue,
  legExerciseIndex,
  liftWeekOverWeek,
  nutritionWeek,
  pickWeeklyFocus,
  postOpWeek,
  programWeekInfo,
  quadLsiTrend,
  readinessCounts,
  sessionsForBlock,
  sleepWeek,
  weekAdherence,
  weekDateRange,
  weeklyHardLegSets,
  weeklySummaryText,
  weekStreak,
  weeklyScoreboard,
  type FocusMetric,
  type ScoreboardRow,
  type ProgramSettings,
  type WeekAdherence,
} from "@fitness-app/application";
import type { TrainingProgram } from "@fitness-app/domain";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import { splitLoggedLifts } from "./helpers";
import { loadProgramContext } from "./server";
import type { AdherenceSnapshot, WeeklyReviewData } from "./types";

/** Habit that counts as the daily ROM check. */
const ROM_HABIT_PREFIX = "rom check";
const WAIST_LOOKBACK_DAYS = 180;

function firstProgramWeek(program: TrainingProgram) {
  return Math.min(...program.blocks.map((b) => b.startWeek));
}

/** Shared loads for the scorecard: lifts, rides, ROM days, over a date range. */
async function loadActivity(
  userId: string,
  program: TrainingProgram,
  start: string,
  end: string,
) {
  const {
    strengthService,
    cardioService,
    supplementService,
    supplementLogService,
  } = await createCoreServices();
  const [sessions, rides, habits, habitLogs] = await Promise.all([
    strengthService.listByDateRange({
      userId,
      startDate: start,
      endDate: end,
      limit: 2000,
    }),
    cardioService.listByDateRange({
      userId,
      startDate: start,
      endDate: end,
      limit: 2000,
    }),
    supplementService.listActive({ userId }),
    supplementLogService.listByDateRange({
      userId,
      startDate: start,
      endDate: end,
    }),
  ]);
  const romIds = new Set(
    habits
      .filter(
        (h) =>
          h.kind === "habit" &&
          h.name.trim().toLowerCase().startsWith(ROM_HABIT_PREFIX),
      )
      .map((h) => h.id),
  );
  // Linked lifts count once per program session, the rest once per day.
  const { liftDates, linkedLifts } = splitLoggedLifts(
    sessions.filter((s) => s.sets.length > 0),
    new Set(program.sessions.map((s) => s.id)),
  );
  return {
    sessions,
    liftDates,
    linkedLifts,
    rideDates: new Set(
      rides
        .filter((r) => r.plannedVsCompleted !== "skipped")
        .map((r) => r.sessionDate),
    ),
    romDates: new Set(
      habitLogs
        .filter((l) => l.taken && romIds.has(l.supplementId))
        .map((l) => l.logDate),
    ),
  };
}

/** Lift counts for completed program weeks before `week`, newest first. */
function completedWeekLifts(
  program: TrainingProgram,
  week: number,
  activity: Pick<
    Awaited<ReturnType<typeof loadActivity>>,
    "liftDates" | "linkedLifts"
  >,
) {
  const first = firstProgramWeek(program);
  const counts: number[] = [];
  for (let w = week - 1; w >= first; w -= 1) {
    const { start } = weekDateRange(program.weekAnchorDate, w);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    counts.push(countLifts(dates, activity.liftDates, activity.linkedLifts));
  }
  return counts;
}

/**
 * Home-screen adherence: this week's scorecard, streaks, and the execution,
 * surplus and waist prompts. Null without an active program.
 */
export async function getAdherenceSnapshot(): Promise<AdherenceSnapshot | null> {
  const ctx = await loadProgramContext();
  if (!ctx) return null;
  const user = await requireCurrentUser();
  const { program, settings, today } = ctx;
  const info = programWeekInfo(program, today);
  const firstStart = weekDateRange(
    program.weekAnchorDate,
    firstProgramWeek(program),
  ).start;
  const { bodyMetricService, programService } = await createCoreServices();
  const [activity, body, checkins] = await Promise.all([
    loadActivity(
      user.id,
      program,
      firstStart < today ? firstStart : today,
      today,
    ),
    bodyMetricService.listByDateRange({
      userId: user.id,
      startDate: addDays(today, -WAIST_LOOKBACK_DAYS),
      endDate: today,
    }),
    programService.listWeeklyCheckins(user.id, info.weekStart, info.weekStart),
  ]);
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addDays(info.weekStart, i),
  );
  const checkin = checkins[0] ?? null;
  const adherence = weekAdherence({
    weekDates,
    liftDates: activity.liftDates,
    linkedLifts: activity.linkedLifts,
    rideDates: activity.rideDates,
    romDates: activity.romDates,
    pt: checkin
      ? {
          attended: checkin.ptVisitsAttended,
          scheduled: checkin.ptVisitsScheduled,
        }
      : null,
    settings,
  });
  const pastWeeks = completedWeekLifts(program, info.week, activity);
  const trend = buildWeeklyWeightTrend(body, today, {
    riseLbPerWeek: settings.weightRiseLbPerWeek,
    weeks: settings.weightRiseWeeks,
  });
  const lastWaist = [...body]
    .filter((m) => m.waistIn != null || m.waistCm != null)
    .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))[0];
  return {
    adherence,
    liftStreakWeeks: weekStreak(pastWeeks, settings.liftsPerWeek),
    romStreakDays: dayStreak(activity.romDates, today),
    executionBanner: executionBanner(
      pastWeeks,
      settings.liftsPerWeek,
      settings.executionBannerWeeks,
    ),
    surplusBanner: trend.surplusThrottle,
    waistDue:
      !lastWaist ||
      lastWaist.measuredOn <= addDays(today, -settings.waistEveryDays),
    lastWaistOn: lastWaist?.measuredOn ?? null,
  };
}

function focusMetrics(input: {
  adherence: WeekAdherence;
  proteinAvg: number | null;
  proteinTarget: number | null;
  sleepAvg: number | null;
  quadSets: number;
  asymmetry: number | null;
  settings: ProgramSettings;
}): FocusMetric[] {
  const a = input.adherence;
  const s = input.settings;
  return [
    {
      key: "lifts",
      label: "Leg sessions",
      actual: a.lifts.done,
      target: a.lifts.target,
      advice: "Put all three lifts in the calendar now and protect them.",
    },
    {
      key: "rom",
      label: "Daily ROM check",
      actual: a.romDays.done,
      target: a.romDays.target,
      advice:
        "Five minutes, every day: prone hang and heel slides first thing.",
    },
    {
      key: "pt",
      label: "PT visits",
      actual: a.pt.attended,
      target: a.pt.scheduled,
      advice: "Keep both PT slots; reschedule a missed one the same week.",
    },
    {
      key: "rides",
      label: "Peloton rides",
      actual: a.rides.done,
      target: a.rides.target,
      advice: "Ride Tue/Thu/Sat; a short Zone 2 beats a skipped one.",
    },
    {
      key: "protein",
      label: "Protein",
      actual: input.proteinAvg,
      target: input.proteinTarget,
      advice: "Front-load it: 50 g by 9 AM makes the day's target easy.",
    },
    {
      key: "sleep",
      label: "Sleep",
      actual: input.sleepAvg,
      target: s.sleepFlagBelowH,
      advice: "Hold the wake time and get in bed by 9:30-10 PM.",
    },
    {
      key: "quad_sets",
      label: "Hard quad sets",
      actual: input.quadSets,
      target: s.quadSetsMin,
      advice: "Finish every prescribed quad set; they are the limiter.",
    },
    {
      key: "asymmetry",
      label: "Walking asymmetry",
      actual: input.asymmetry,
      target: s.walkingAsymmetryTargetPct,
      lowerIsBetter: true,
      advice: "Do the gait drill on every lift day and walk more.",
    },
  ];
}

/**
 * One point per post-op week: the week's last crane-test LSI and walking
 * asymmetry from the PT Tracker, else the hand-typed check-in.
 */
function markerTrend(input: {
  anchor: string;
  first: number;
  week: number;
  checkins: {
    weekStart: string;
    quadLsiPct: number | null;
    walkingAsymmetryPct: number | null;
  }[];
  lsi: { date: string; lsi: number }[];
  asymmetry: { testDate: string; value: number }[];
}): WeeklyReviewData["trend"] {
  const points: WeeklyReviewData["trend"] = [];
  for (let w = input.first; w <= input.week; w += 1) {
    const { start, end } = weekDateRange(input.anchor, w);
    const within = (d: string) => d >= start && d <= end;
    const lsi = input.lsi.filter((p) => within(p.date)).at(-1)?.lsi;
    const asym = input.asymmetry
      .filter((p) => within(p.testDate))
      .at(-1)?.value;
    const checkin = input.checkins.find((c) => c.weekStart === start);
    const point = {
      week: w,
      quadLsiPct: lsi ?? checkin?.quadLsiPct ?? null,
      walkingAsymmetryPct: asym ?? checkin?.walkingAsymmetryPct ?? null,
    };
    if (point.quadLsiPct != null || point.walkingAsymmetryPct != null)
      points.push(point);
  }
  return points;
}

/** Everything for the Sunday review of post-op week `weekParam` (default: this week). */
export async function getWeeklyReviewData(
  weekParam?: number,
): Promise<WeeklyReviewData | null> {
  const ctx = await loadProgramContext();
  if (!ctx) return null;
  const user = await requireCurrentUser();
  const { program, settings, today } = ctx;
  const currentWeek = postOpWeek(program.weekAnchorDate, today);
  const first = firstProgramWeek(program);
  const week =
    weekParam != null && Number.isInteger(weekParam)
      ? Math.min(Math.max(weekParam, first), currentWeek)
      : currentWeek;
  const range = weekDateRange(program.weekAnchorDate, week);
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addDays(range.start, i),
  );
  const info = programWeekInfo(program, range.start);
  const firstStart = weekDateRange(program.weekAnchorDate, first).start;

  const {
    programService,
    nutritionService,
    recoveryService,
    bodyMetricService,
  } = await createCoreServices();
  const [
    activity,
    checkins,
    nutrition,
    recovery,
    body,
    checks,
    profile,
    kneeTests,
  ] = await Promise.all([
    loadActivity(
      user.id,
      program,
      [firstStart, addDays(range.start, -7)].sort()[0]!,
      range.end,
    ),
    programService.listWeeklyCheckins(user.id, firstStart, range.start),
    nutritionService.listByDateRange({
      userId: user.id,
      startDate: range.start,
      endDate: range.end,
    }),
    recoveryService.listByDateRange({
      userId: user.id,
      startDate: range.start,
      endDate: range.end,
    }),
    bodyMetricService.listByDateRange({
      userId: user.id,
      startDate: addDays(range.end, -7 * (settings.weightRiseWeeks + 1)),
      endDate: range.end,
    }),
    programService.listKneeChecks(user.id, range.start, range.end),
    getCachedUserProfile(user.id),
    programService.listKneeTests(user.id, addDays(firstStart, -14), range.end),
  ]);

  const checkin = checkins.find((c) => c.weekStart === range.start) ?? null;
  // PT Tracker numbers first (synced knee_tests), the hand-typed check-in as
  // the fallback for weeks before the sync.
  const knee = kneeTestSummary({
    tests: kneeTests,
    sessions: activity.sessions,
    upTo: range.end,
    quadDropHoldN: settings.quadDropHoldN,
  });
  const inWeek = (date: string | undefined) =>
    date != null && date >= range.start && date <= range.end;
  const weekQuadLsi =
    (inWeek(knee.quad90?.date) ? knee.quad90?.lsi : null) ??
    checkin?.quadLsiPct ??
    null;
  const weekAsymmetry =
    (inWeek(knee.walkingAsymmetry?.date)
      ? knee.walkingAsymmetry?.value
      : null) ??
    checkin?.walkingAsymmetryPct ??
    null;
  const adherence = weekAdherence({
    weekDates,
    liftDates: activity.liftDates,
    linkedLifts: activity.linkedLifts,
    rideDates: activity.rideDates,
    romDates: activity.romDates,
    pt: checkin
      ? {
          attended: checkin.ptVisitsAttended,
          scheduled: checkin.ptVisitsScheduled,
        }
      : null,
    settings,
  });
  const pastWeeks = completedWeekLifts(program, week, activity);
  const thisWeekLifts = adherence.lifts.done;
  const isLiftDay = (date: string) =>
    buildDayPlan(program, date, null, settings).sessions.some(
      (s) => s.session.sessionType === "lift" && s.visible,
    );
  const fuel = nutritionWeek({
    logs: nutrition.map((l) => ({
      logDate: l.logDate,
      proteinGrams: l.proteinGrams ?? null,
      calories: l.calories ?? null,
      creatineTaken: l.creatineTaken ?? null,
      protein50By9am: l.protein50By9am ?? null,
    })),
    weekDates,
    isLiftDay,
    proteinTarget: profile?.dailyProteinGramsTarget ?? null,
    settings,
  });
  const sleep = sleepWeek(recovery, weekDates, settings.sleepFlagBelowH);
  const weight = buildWeeklyWeightTrend(body, range.end, {
    riseLbPerWeek: settings.weightRiseLbPerWeek,
    weeks: settings.weightRiseWeeks,
  });
  const readiness = readinessCounts(
    weekDates.map((d) =>
      kneeReadinessStatus(checks.find((c) => c.date === d) ?? null, settings),
    ),
  );

  const legExercises = program.sessions
    .flatMap((s) => s.exercises)
    .filter((e) => e.blockPart === "legs");
  const quadSets = weeklyHardLegSets(
    activity.sessions,
    legExerciseIndex(legExercises),
    range,
    settings.hardSetMaxRir,
  ).quadSets;

  const seen = new Set<string>();
  const mainLifts = (info.block ? sessionsForBlock(program, info.block) : [])
    .filter((s) => s.sessionType === "lift")
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .flatMap((s) =>
      s.exercises.filter(
        (e) =>
          e.blockPart === "legs" &&
          e.measure === "reps" &&
          e.loadKind !== "bodyweight" &&
          e.loadKind !== "band",
      ),
    )
    .flatMap((e) =>
      [e.name, e.substituteName]
        .filter((n): n is string => n != null)
        .map((name) => ({ name, perLeg: e.sideMode === "per_leg" })),
    )
    .filter((l) => {
      const key = l.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const lifts = liftWeekOverWeek(activity.sessions, mainLifts, range);

  const nextBlock =
    [...program.blocks]
      .filter((b) => b.startWeek > week)
      .sort((a, b) => a.startWeek - b.startWeek)
      .map((b) => ({
        name: b.name,
        date: weekDateRange(program.weekAnchorDate, b.startWeek).start,
      }))[0] ?? null;

  const focus = pickWeeklyFocus(
    focusMetrics({
      adherence,
      proteinAvg: fuel.proteinAvg,
      proteinTarget: fuel.proteinTarget,
      sleepAvg: sleep.avgHours,
      quadSets,
      asymmetry: weekAsymmetry,
      settings,
    }),
  );

  const summaryInput = {
    week,
    weekStart: range.start,
    weekEnd: range.end,
    blockName: info.block?.name ?? null,
    nextBlock,
    adherence,
    liftStreakWeeks: weekStreak(
      thisWeekLifts >= settings.liftsPerWeek
        ? [thisWeekLifts, ...pastWeeks]
        : pastWeeks,
      settings.liftsPerWeek,
    ),
    romStreakDays: dayStreak(
      activity.romDates,
      range.end < today ? range.end : today,
    ),
    readiness,
    lifts,
    quadSets: {
      done: quadSets,
      min: settings.quadSetsMin,
      max: settings.quadSetsMax,
    },
    nutrition: fuel,
    weight: {
      sevenDayAvgLb: weight.sevenDayAvgLb,
      weekOverWeekLb: weight.weekOverWeekLb,
    },
    sleep,
    quadLsiPct: weekQuadLsi,
    walkingAsymmetryPct: weekAsymmetry,
    focus,
  };

  return {
    ...summaryInput,
    currentWeek,
    firstWeek: first,
    checkin,
    trend: markerTrend({
      anchor: program.weekAnchorDate,
      first,
      week,
      checkins,
      lsi: quadLsiTrend(kneeTests),
      asymmetry: kneeTests.filter((t) => t.testType === "walking_asymmetry"),
    }),
    knee,
    kneeAsOf:
      latestValue(
        kneeTests.filter((t) => t.source === "pt_tracker"),
        "quad_iso_90",
      )?.date ?? null,
    targets: {
      lsi: [settings.lsiTarget1, settings.lsiTarget2, settings.lsiTarget3],
      asymmetry: settings.walkingAsymmetryTargetPct,
      sleepH: settings.sleepFlagBelowH,
      proteinFlagG: settings.proteinFlagBelowG,
    },
    surplusBanner: weight.surplusThrottle,
    summaryText: weeklySummaryText(summaryInput),
  };
}

/** Weeks shown on the scoreboard, newest first. */
const SCOREBOARD_WEEKS = 12;

/**
 * The Sunday scoreboard: one row per post-op week (newest first) from the
 * program's first week, at most 12. Null without an active program.
 */
export async function getWeeklyScoreboard(): Promise<ScoreboardRow[] | null> {
  const ctx = await loadProgramContext();
  if (!ctx) return null;
  const user = await requireCurrentUser();
  const { program, today } = ctx;
  const current = postOpWeek(program.weekAnchorDate, today);
  const first = Math.max(
    firstProgramWeek(program),
    current - SCOREBOARD_WEEKS + 1,
  );
  const weeks = [];
  for (let w = first; w <= current; w += 1) {
    weeks.push({ week: w, ...weekDateRange(program.weekAnchorDate, w) });
  }
  if (weeks.length === 0) return [];
  const start = weeks[0]!.start;
  const end = weeks.at(-1)!.end;
  const {
    bodyMetricService,
    nutritionService,
    dailyActivityService,
    programService,
  } = await createCoreServices();
  const [body, nutrition, activity, kneeTests, checkins] = await Promise.all([
    bodyMetricService.listByDateRange({
      userId: user.id,
      startDate: start,
      endDate: end,
      limit: 2000,
    }),
    nutritionService.listByDateRange({
      userId: user.id,
      startDate: start,
      endDate: end,
      limit: 2000,
    }),
    dailyActivityService.listByDateRange({
      userId: user.id,
      startDate: start,
      endDate: end,
      limit: 2000,
    }),
    programService.listKneeTests(user.id, start, end),
    programService.listWeeklyCheckins(user.id, start, end),
  ]);
  return weeklyScoreboard({
    weeks,
    body,
    nutrition,
    kneeTests,
    activity,
    checkins,
  }).reverse();
}
