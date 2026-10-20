import type {
  IsoDate,
  KneeReadinessStatus,
  TrainingProgram,
  TrainingSetting,
} from "@fitness-app/domain";
import { addDays } from "./program-calendar";
import {
  buildDayPlan,
  type DayPlan,
  type PlannedSession,
} from "./program-plan";
import type { DatedKneeCheck, ProgramService } from "./program-service";
import { kneeReadinessStatus } from "./knee-readiness";
import {
  applySettingGates,
  programSettingsFromRows,
  type ProgramSettings,
} from "./program-settings";

/**
 * The active program as every screen plans from it: settings from their
 * rows, settings-driven gates applied, and each day's knee check status.
 */
export function resolveProgram(
  loaded: TrainingProgram,
  settingRows: Pick<TrainingSetting, "key" | "value" | "textValue">[],
  checks: DatedKneeCheck[],
): {
  program: TrainingProgram;
  settings: ProgramSettings;
  statusOn: (date: IsoDate) => KneeReadinessStatus | null;
} {
  const settings = programSettingsFromRows(settingRows);
  return {
    program: { ...loaded, gates: applySettingGates(loaded.gates, settings) },
    settings,
    statusOn: (date) =>
      kneeReadinessStatus(
        checks.find((c) => c.date === date) ?? null,
        settings,
      ),
  };
}

/** What the week counts read from a planned session (plan or screen view). */
export type WeekCountableSession = {
  type: string;
  visible: boolean;
  ride: { kind: string; minutesMax: number | null } | null;
};

export function countableSession(s: PlannedSession): WeekCountableSession {
  return { type: s.session.sessionType, visible: s.visible, ride: s.ride };
}

/** A lift or ride the program schedules that day (its gate is open). */
export function isScheduledSession(s: WeekCountableSession) {
  return s.visible && (s.type === "lift" || s.type === "peloton");
}

/**
 * The Zone 2 minutes a scheduled ride declares: the top of a Zone 2 ride's
 * range. Interval rides declare none here.
 */
export function plannedZone2Minutes(s: WeekCountableSession): number | null {
  if (!isScheduledSession(s) || s.ride?.kind !== "zone2") return null;
  return s.ride.minutesMax ?? null;
}

export type ProgramWeekTargets = {
  liftsScheduled: number;
  cardioScheduled: number;
  zone2TargetMinutes: number;
};

/**
 * The week's scheduled lifts and rides and its Zone 2 target, from the
 * program's planned sessions. The dashboard plan card, the cardio page and
 * the weekly review all count with this.
 */
export function programWeekTargets(
  sessions: WeekCountableSession[],
): ProgramWeekTargets {
  const scheduled = sessions.filter(isScheduledSession);
  return {
    liftsScheduled: scheduled.filter((s) => s.type === "lift").length,
    cardioScheduled: scheduled.filter((s) => s.type === "peloton").length,
    zone2TargetMinutes: scheduled.reduce(
      (sum, s) => sum + (plannedZone2Minutes(s) ?? 0),
      0,
    ),
  };
}

/** Every date from `start` to `end`, inclusive. */
export function datesBetween(start: IsoDate, end: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/**
 * The program's day plans for `dates`, or null when no program block covers
 * any of them (the caller then has no program week to count).
 */
export function programDayPlans(
  program: TrainingProgram,
  dates: IsoDate[],
  statusOn: (date: IsoDate) => KneeReadinessStatus | null,
  settings: ProgramSettings,
): DayPlan[] | null {
  const plans = dates.map((date) =>
    buildDayPlan(program, date, statusOn(date), settings),
  );
  return plans.some((p) => p.info.block != null) ? plans : null;
}

/**
 * The week's targets from the active program, for a review week (start to
 * end, inclusive), with that week's knee checks applied the way the
 * dashboard applies them. Null without an active program or when no block
 * covers the week.
 */
export async function loadProgramWeekTargets(
  programService: Pick<
    ProgramService,
    "getActiveProgram" | "listSettings" | "listKneeChecks"
  >,
  query: { userId: string; startDate: IsoDate; endDate: IsoDate },
): Promise<ProgramWeekTargets | null> {
  const loaded = await programService.getActiveProgram(query.userId);
  if (!loaded) return null;
  const [settingRows, checks] = await Promise.all([
    programService.listSettings(query.userId),
    programService.listKneeChecks(query.userId, query.startDate, query.endDate),
  ]);
  const { program, settings, statusOn } = resolveProgram(
    loaded,
    settingRows,
    checks,
  );
  const plans = programDayPlans(
    program,
    datesBetween(query.startDate, query.endDate),
    statusOn,
    settings,
  );
  if (!plans) return null;
  return programWeekTargets(
    plans.flatMap((p) => p.sessions.map(countableSession)),
  );
}
