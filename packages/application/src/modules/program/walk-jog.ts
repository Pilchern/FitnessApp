import type { IsoDate, KneeReadinessStatus } from "@fitness-app/domain";
import { addDays } from "./program-calendar";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
} from "./program-settings";

export type WalkJogRun = {
  date: IsoDate;
  /** Total minutes running in the session. */
  runMinutes: number;
};

export type WalkJogAdvice = {
  action: "start" | "run" | "rest";
  /** Total minutes of running to aim for; null on a rest day. */
  runMinutesMin: number | null;
  runMinutesMax: number | null;
  /** "1.5 min jog / 1 min walk x 6". */
  structure: string | null;
  reason: string;
  /** Rest days: first day running can resume. */
  resumeOn: IsoDate | null;
};

type WalkJogSettings = Pick<
  ProgramSettings,
  | "walkJogStartRunMin"
  | "walkJogStartWalkMin"
  | "walkJogStartRounds"
  | "walkJogStepMin"
  | "walkJogStepMax"
  | "walkJogRestDays"
>;

function structureFor(totalRun: number, s: WalkJogSettings) {
  const jog = Math.round((totalRun / s.walkJogStartRounds) * 2) / 2;
  return `${jog} min jog / ${s.walkJogStartWalkMin} min walk x ${s.walkJogStartRounds}`;
}

/**
 * Next walk-jog, from the logged runs and morning knee checks:
 * - No runs yet: start at 1 min jog / 1 min walk x 6.
 * - The first knee check after the last run was normal: add 1-2 min of
 *   running in total.
 * - It was not normal: no running for 2 days after that check (bike
 *   instead), then resume one step back (the last lower level, or the start).
 * - No check since the last run: repeat it.
 */
export function walkJogAdvice(input: {
  runs: WalkJogRun[];
  checks: { date: IsoDate; status: KneeReadinessStatus | null }[];
  today: IsoDate;
  settings?: WalkJogSettings;
}): WalkJogAdvice {
  const s = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
  const start = s.walkJogStartRunMin * s.walkJogStartRounds;
  const runs = input.runs
    .filter((r) => r.date < input.today && r.runMinutes > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = runs[0];

  if (!last) {
    return {
      action: "start",
      runMinutesMin: start,
      runMinutesMax: start,
      structure: structureFor(start, s),
      reason: "First walk-jog.",
      resumeOn: null,
    };
  }

  const nextCheck = [...input.checks]
    .filter((c) => c.date > last.date && c.status != null)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!nextCheck) {
    return {
      action: "run",
      runMinutesMin: last.runMinutes,
      runMinutesMax: last.runMinutes,
      structure: structureFor(last.runMinutes, s),
      reason: "No knee check since the last run: repeat it.",
      resumeOn: null,
    };
  }

  if (nextCheck.status === "normal") {
    const min = last.runMinutes + s.walkJogStepMin;
    const max = last.runMinutes + s.walkJogStepMax;
    return {
      action: "run",
      runMinutesMin: min,
      runMinutesMax: max,
      structure: structureFor(min, s),
      reason: `Knee was normal after ${last.runMinutes} min: add ${s.walkJogStepMin}–${s.walkJogStepMax} min.`,
      resumeOn: null,
    };
  }

  const resumeOn = addDays(nextCheck.date, s.walkJogRestDays + 1);
  if (input.today < resumeOn) {
    return {
      action: "rest",
      runMinutesMin: null,
      runMinutesMax: null,
      structure: null,
      reason: `Knee check not normal on ${nextCheck.date}: no running for ${s.walkJogRestDays} days, bike instead.`,
      resumeOn,
    };
  }

  const lower = runs.find((r) => r.runMinutes < last.runMinutes);
  const back = Math.max(start, lower?.runMinutes ?? start);
  return {
    action: "run",
    runMinutesMin: back,
    runMinutesMax: back,
    structure: structureFor(back, s),
    reason: "Back after a non-normal knee check: one step back.",
    resumeOn: null,
  };
}
