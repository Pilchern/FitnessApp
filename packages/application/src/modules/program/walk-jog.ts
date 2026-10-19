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
  /** Minutes walking between runs; 0 or null for a continuous run. */
  walkMinutes?: number | null;
};

export type WalkJogAdvice = {
  action: "start" | "run" | "rest";
  /** Total minutes of running to aim for; null on a rest day. */
  runMinutesMin: number | null;
  runMinutesMax: number | null;
  /** "1.5 min jog / 1 min walk x 6" or "12 min continuous". */
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

/**
 * The stage ladder (program v1): 1:1 x6, 2:1 x6, 3:1 x5, 5:1 x4, then 10, 15,
 * 20 and 30 min continuous. Running grows 1-2 min a session between stages;
 * each interval total uses the rounds of the stage at or below it.
 */
export const WALK_JOG_STAGES = [
  { phase: "interval", runMinutes: 6, rounds: 6 },
  { phase: "interval", runMinutes: 12, rounds: 6 },
  { phase: "interval", runMinutes: 15, rounds: 5 },
  { phase: "interval", runMinutes: 20, rounds: 4 },
  { phase: "continuous", runMinutes: 10, rounds: 1 },
  { phase: "continuous", runMinutes: 15, rounds: 1 },
  { phase: "continuous", runMinutes: 20, rounds: 1 },
  { phase: "continuous", runMinutes: 30, rounds: 1 },
] as const;

type Phase = (typeof WALK_JOG_STAGES)[number]["phase"];
const LAST_INTERVAL = 3;
const FIRST_CONTINUOUS = 4;
const CONTINUOUS_CAP = 30;

function phaseOf(run: WalkJogRun): Phase {
  if (run.walkMinutes != null && run.walkMinutes > 0) return "interval";
  return run.runMinutes >= 10 ? "continuous" : "interval";
}

/** Index of the stage at or below `minutes` within its phase. */
function stageIndex(phase: Phase, minutes: number) {
  let index = phase === "interval" ? 0 : FIRST_CONTINUOUS;
  WALK_JOG_STAGES.forEach((stage, i) => {
    if (stage.phase === phase && stage.runMinutes <= minutes) index = i;
  });
  return index;
}

function structureFor(phase: Phase, totalRun: number, s: WalkJogSettings) {
  if (phase === "continuous") return `${totalRun} min continuous`;
  const rounds =
    totalRun < WALK_JOG_STAGES[1].runMinutes
      ? s.walkJogStartRounds
      : WALK_JOG_STAGES[stageIndex("interval", totalRun)].rounds;
  const jog = Math.round((totalRun / rounds) * 2) / 2;
  return `${jog} min jog / ${s.walkJogStartWalkMin} min walk x ${rounds}`;
}

function advice(
  phase: Phase,
  min: number,
  max: number,
  reason: string,
  s: WalkJogSettings,
  action: WalkJogAdvice["action"] = "run",
): WalkJogAdvice {
  return {
    action,
    runMinutesMin: min,
    runMinutesMax: max,
    structure: structureFor(phase, min, s),
    reason,
    resumeOn: null,
  };
}

/**
 * Next walk-jog, from the logged runs and morning knee checks:
 * - No runs yet: start at 1 min jog / 1 min walk x 6.
 * - The first knee check after the last run was normal: add 1-2 min of
 *   running in total. After 5:1 x4 (20 min) the next step is 10 min
 *   continuous; continuous running tops out at 30 min (from week 23 the
 *   weekly 10% rule takes over).
 * - It was not normal: no running for 2 days after that check (bike
 *   instead), then resume one stage back (never below the start).
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
    return advice("interval", start, start, "First walk-jog.", s, "start");
  }

  const phase = phaseOf(last);
  const nextCheck = [...input.checks]
    .filter((c) => c.date > last.date && c.status != null)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!nextCheck) {
    return advice(
      phase,
      last.runMinutes,
      last.runMinutes,
      "No knee check since the last run: repeat it.",
      s,
    );
  }

  if (nextCheck.status === "normal") {
    const interval = WALK_JOG_STAGES[LAST_INTERVAL];
    if (phase === "interval" && last.runMinutes >= interval.runMinutes) {
      const first = WALK_JOG_STAGES[FIRST_CONTINUOUS].runMinutes;
      return advice(
        "continuous",
        first,
        first,
        "Knee was normal after 5:1 x 4: next stage is continuous running.",
        s,
      );
    }
    if (phase === "continuous" && last.runMinutes >= CONTINUOUS_CAP) {
      return advice(
        "continuous",
        CONTINUOUS_CAP,
        CONTINUOUS_CAP,
        "30 min continuous reached. From week 23 grow weekly run minutes by 10% at most.",
        s,
      );
    }
    const cap = phase === "interval" ? interval.runMinutes : CONTINUOUS_CAP;
    const min = Math.min(cap, last.runMinutes + s.walkJogStepMin);
    const max = Math.min(cap, last.runMinutes + s.walkJogStepMax);
    return advice(
      phase,
      min,
      max,
      `Knee was normal after ${last.runMinutes} min: add ${s.walkJogStepMin}–${s.walkJogStepMax} min.`,
      s,
    );
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

  const current = stageIndex(phase, last.runMinutes);
  const back = WALK_JOG_STAGES[Math.max(0, current - 1)];
  const minutes = Math.max(
    back.phase === "interval" ? start : 0,
    back.runMinutes,
  );
  return advice(
    back.phase,
    minutes,
    minutes,
    "Back after a non-normal knee check: one stage back.",
    s,
  );
}
