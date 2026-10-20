import type {
  IsoDate,
  KneeReadinessStatus,
  StrengthSession,
} from "@fitness-app/domain";
import { addDays } from "./program-calendar";
import { exerciseProgress } from "./program-progression";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
} from "./program-settings";

export type Ratio = { done: number; target: number };

export type WeekAdherence = {
  lifts: Ratio;
  rides: Ratio;
  romDays: Ratio;
  /** Manual; null until entered. */
  pt: { attended: number | null; scheduled: number | null };
};

/** A logged lift linked to the program session it fulfils. */
export type LinkedLiftDate = { date: IsoDate; programSessionId: string };

/**
 * Lifts done on `dates`: unlinked lifts once per day (`liftDates`), plus
 * linked lifts once per program session. Two program sessions logged on one
 * day count as two; without links the count is per day, as before.
 */
export function countLifts(
  dates: IsoDate[],
  liftDates: Set<IsoDate>,
  linkedLifts: readonly LinkedLiftDate[] = [],
) {
  const inRange = new Set(dates);
  const linked = new Set(
    linkedLifts
      .filter((l) => inRange.has(l.date))
      .map((l) => l.programSessionId),
  );
  return dates.filter((d) => liftDates.has(d)).length + linked.size;
}

/**
 * The week's scorecard: leg sessions, rides and ROM-check days done in the
 * week's dates (each counted once per day; linked lifts once per program
 * session), against the settings targets, plus the manually entered PT
 * visits.
 */
export function weekAdherence(input: {
  weekDates: IsoDate[];
  /** Days with an unlinked lift (all lifts, when nothing is linked). */
  liftDates: Set<IsoDate>;
  linkedLifts?: readonly LinkedLiftDate[];
  rideDates: Set<IsoDate>;
  romDates: Set<IsoDate>;
  pt?: { attended: number | null; scheduled: number | null } | null;
  settings?: Pick<
    ProgramSettings,
    "liftsPerWeek" | "ridesPerWeek" | "romDaysPerWeek" | "ptVisitsPerWeek"
  >;
}): WeekAdherence {
  const s = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
  const count = (set: Set<IsoDate>) =>
    input.weekDates.filter((d) => set.has(d)).length;
  return {
    lifts: {
      done: countLifts(input.weekDates, input.liftDates, input.linkedLifts),
      target: s.liftsPerWeek,
    },
    rides: { done: count(input.rideDates), target: s.ridesPerWeek },
    romDays: { done: count(input.romDates), target: s.romDaysPerWeek },
    pt: {
      attended: input.pt?.attended ?? null,
      scheduled: input.pt?.scheduled ?? s.ptVisitsPerWeek,
    },
  };
}

/** Completed weeks in a row (newest first) that met the target. */
export function weekStreak(doneNewestFirst: number[], target: number) {
  let streak = 0;
  for (const done of doneNewestFirst) {
    if (done < target) break;
    streak += 1;
  }
  return streak;
}

/** Days in a row with an entry, ending today (or yesterday before today's). */
export function dayStreak(dates: Set<IsoDate>, today: IsoDate) {
  let day = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/**
 * "Execution is the bottleneck, not the program": the last `weeks` completed
 * weeks (newest first) each had fewer leg sessions than the target.
 */
export function executionBanner(
  liftsDoneNewestFirst: number[],
  target: number,
  weeks: number,
) {
  const recent = liftsDoneNewestFirst.slice(0, Math.max(1, weeks));
  return (
    recent.length >= Math.max(1, weeks) && recent.every((done) => done < target)
  );
}

export type NutritionDay = {
  logDate: IsoDate;
  proteinGrams: number | null;
  calories: number | null;
  creatineTaken: boolean | null;
  protein50By9am: boolean | null;
};

export type NutritionWeek = {
  daysLogged: number;
  proteinAvg: number | null;
  proteinTarget: number | null;
  /** Protein average under the flag line (160 g). */
  proteinFlag: boolean;
  caloriesAvg: number | null;
  /** Mean of each logged day's target: lift days use the range midpoint. */
  caloriesTargetAvg: number | null;
  creatineDays: number;
  protein50Days: number;
};

function mean(values: number[]) {
  return values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

/** Weekly averages from the fast daily entries; days without a number are skipped. */
export function nutritionWeek(input: {
  logs: NutritionDay[];
  weekDates: IsoDate[];
  isLiftDay: (date: IsoDate) => boolean;
  proteinTarget: number | null;
  settings?: Pick<
    ProgramSettings,
    | "caloriesLiftDayMin"
    | "caloriesLiftDayMax"
    | "caloriesRestDay"
    | "proteinFlagBelowG"
  >;
}): NutritionWeek {
  const s = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
  const week = new Set(input.weekDates);
  const logs = input.logs.filter((l) => week.has(l.logDate));
  const protein = logs
    .map((l) => l.proteinGrams)
    .filter((v): v is number => v != null);
  const calorieDays = logs.filter((l) => l.calories != null);
  const proteinAvg = mean(protein);
  return {
    daysLogged: logs.length,
    proteinAvg: proteinAvg != null ? Math.round(proteinAvg) : null,
    proteinTarget: input.proteinTarget,
    proteinFlag: proteinAvg != null && proteinAvg < s.proteinFlagBelowG,
    caloriesAvg:
      calorieDays.length > 0
        ? Math.round(mean(calorieDays.map((l) => l.calories as number)) ?? 0)
        : null,
    caloriesTargetAvg:
      calorieDays.length > 0
        ? Math.round(
            mean(
              calorieDays.map((l) =>
                input.isLiftDay(l.logDate)
                  ? (s.caloriesLiftDayMin + s.caloriesLiftDayMax) / 2
                  : s.caloriesRestDay,
              ),
            ) ?? 0,
          )
        : null,
    creatineDays: logs.filter((l) => l.creatineTaken === true).length,
    protein50Days: logs.filter((l) => l.protein50By9am === true).length,
  };
}

export type SleepWeek = {
  nights: number;
  avgHours: number | null;
  avgQuality: number | null;
  /** Average under the flag line (7 h). */
  flag: boolean;
};

/** Average sleep over the week's check-ins (dated by wake day). */
export function sleepWeek(
  rows: {
    checkinDate: IsoDate;
    sleepDurationMinutes: number | null;
    sleepQuality: number | null;
  }[],
  weekDates: IsoDate[],
  flagBelowH: number = DEFAULT_PROGRAM_SETTINGS.sleepFlagBelowH,
): SleepWeek {
  const week = new Set(weekDates);
  const inWeek = rows.filter((r) => week.has(r.checkinDate));
  const minutes = inWeek
    .map((r) => r.sleepDurationMinutes)
    .filter((v): v is number => v != null && v > 0);
  const quality = inWeek
    .map((r) => r.sleepQuality)
    .filter((v): v is number => v != null);
  const avg = mean(minutes);
  const avgHours = avg != null ? Math.round((avg / 60) * 10) / 10 : null;
  const avgQuality = mean(quality);
  return {
    nights: minutes.length,
    avgHours,
    avgQuality: avgQuality != null ? Math.round(avgQuality * 10) / 10 : null,
    flag: avgHours != null && avgHours < flagBelowH,
  };
}

export type ReadinessCounts = {
  normal: number;
  hold: number;
  kneeOff: number;
  unchecked: number;
};

export function readinessCounts(
  statuses: (KneeReadinessStatus | null)[],
): ReadinessCounts {
  return {
    normal: statuses.filter((s) => s === "normal").length,
    hold: statuses.filter((s) => s === "hold").length,
    kneeOff: statuses.filter((s) => s === "knee_off").length,
    unchecked: statuses.filter((s) => s == null).length,
  };
}

export type LiftWeekProgress = {
  name: string;
  perLeg: boolean;
  thisWeek: { load: number | null; left: number | null; right: number | null };
  lastWeek: { load: number | null; left: number | null; right: number | null };
};

function topIn(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  name: string,
  range: { start: IsoDate; end: IsoDate },
) {
  const points = exerciseProgress(sessions, name).filter(
    (p) => p.date >= range.start && p.date <= range.end,
  );
  const max = (vals: (number | null)[]) => {
    const present = vals.filter((v): v is number => v != null);
    return present.length > 0 ? Math.max(...present) : null;
  };
  return {
    load: max(points.map((p) => p.load)),
    left: max(points.map((p) => p.leftLoad)),
    right: max(points.map((p) => p.rightLoad)),
  };
}

/** Top load per main lift this week vs last week; per-leg lifts split L/R. */
export function liftWeekOverWeek(
  sessions: Pick<StrengthSession, "sessionDate" | "sets">[],
  lifts: { name: string; perLeg: boolean }[],
  thisWeek: { start: IsoDate; end: IsoDate },
): LiftWeekProgress[] {
  const lastWeek = {
    start: addDays(thisWeek.start, -7),
    end: addDays(thisWeek.end, -7),
  };
  return lifts
    .map((lift) => ({
      ...lift,
      thisWeek: topIn(sessions, lift.name, thisWeek),
      lastWeek: topIn(sessions, lift.name, lastWeek),
    }))
    .filter((l) =>
      [l.thisWeek, l.lastWeek].some(
        (w) => w.load != null || w.left != null || w.right != null,
      ),
    );
}

export type FocusMetric = {
  key: string;
  label: string;
  actual: number | null;
  target: number | null;
  /** Walking asymmetry: lower is better. */
  lowerIsBetter?: boolean;
  advice: string;
};

/** How far a metric is from target: 1 = on target, lower = further off. */
export function metricScore(m: FocusMetric): number | null {
  if (m.actual == null || m.target == null || m.target <= 0) return null;
  if (m.lowerIsBetter) {
    return m.actual <= m.target ? 1 : m.target / m.actual;
  }
  return Math.min(1, m.actual / m.target);
}

/**
 * Next week's focus: the single metric furthest below its target. Metrics
 * are passed in priority order, which breaks ties. Null when all are on
 * target or none has data.
 */
export function pickWeeklyFocus(metrics: FocusMetric[]): FocusMetric | null {
  let worst: { metric: FocusMetric; score: number } | null = null;
  for (const metric of metrics) {
    const score = metricScore(metric);
    if (score == null || score >= 1) continue;
    if (!worst || score < worst.score) worst = { metric, score };
  }
  return worst?.metric ?? null;
}

export type WeeklySummaryInput = {
  week: number;
  weekStart: IsoDate;
  weekEnd: IsoDate;
  blockName: string | null;
  nextBlock: { name: string; date: IsoDate } | null;
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
};

function fmt(value: number | null | undefined, unit = "") {
  return value == null ? "–" : `${value}${unit}`;
}

function signed(value: number | null) {
  if (value == null) return "–";
  return `${value > 0 ? "+" : ""}${value}`;
}

function liftLine(l: LiftWeekProgress) {
  if (l.perLeg) {
    return `${l.name}: L ${fmt(l.thisWeek.left)} / R ${fmt(l.thisWeek.right)} lb (last week L ${fmt(l.lastWeek.left)} / R ${fmt(l.lastWeek.right)})`;
  }
  return `${l.name}: ${fmt(l.thisWeek.load)} lb (last week ${fmt(l.lastWeek.load)})`;
}

/** Plain text for the LifeOS Sunday review. */
export function weeklySummaryText(r: WeeklySummaryInput): string {
  const a = r.adherence;
  const lines = [
    `Post-op week ${r.week}${r.blockName ? ` · ${r.blockName}` : ""} (${r.weekStart} to ${r.weekEnd})`,
    r.nextBlock
      ? `Next block: ${r.nextBlock.name} on ${r.nextBlock.date}`
      : null,
    "",
    "Adherence",
    `- Leg sessions ${a.lifts.done}/${a.lifts.target}, Peloton ${a.rides.done}/${a.rides.target}, ROM check ${a.romDays.done}/${a.romDays.target} days, PT ${fmt(a.pt.attended)}/${fmt(a.pt.scheduled)}`,
    `- Streaks: ${r.liftStreakWeeks} full leg weeks, ${r.romStreakDays} ROM days`,
    `- Knee checks: ${r.readiness.normal} normal, ${r.readiness.hold} repeat loads, ${r.readiness.kneeOff} knee-off, ${r.readiness.unchecked} not checked`,
    "",
    "Legs",
    `- Hard quad sets ${r.quadSets.done} (target ${r.quadSets.min}–${r.quadSets.max})`,
    ...r.lifts.map((l) => `- ${liftLine(l)}`),
    "",
    "Fuel, body, sleep",
    `- Protein avg ${fmt(r.nutrition.proteinAvg, " g")} (target ${fmt(r.nutrition.proteinTarget, " g")})${r.nutrition.proteinFlag ? " LOW" : ""}, calories avg ${fmt(r.nutrition.caloriesAvg)} (target ${fmt(r.nutrition.caloriesTargetAvg)}), creatine ${r.nutrition.creatineDays}/7, 50 g by 9 AM ${r.nutrition.protein50Days}/7`,
    `- Weight 7-day avg ${fmt(r.weight.sevenDayAvgLb, " lb")} (${signed(r.weight.weekOverWeekLb)} lb vs last week)`,
    `- Sleep avg ${fmt(r.sleep.avgHours, " h")} over ${r.sleep.nights} nights${r.sleep.flag ? " LOW" : ""}`,
    "",
    "Rehab markers",
    `- Quad LSI ${fmt(r.quadLsiPct, "%")}, walking asymmetry ${fmt(r.walkingAsymmetryPct, "%")}`,
    "",
    `Next week's focus: ${r.focus ? `${r.focus.label}. ${r.focus.advice}` : "Everything on target. Keep it."}`,
  ];
  return lines.filter((l) => l != null).join("\n");
}
