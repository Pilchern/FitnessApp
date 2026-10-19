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
  /** Ladder index (0 = 1:1 x6); null on a rest day. */
  stage: number | null;
  /** Total minutes of running to aim for; null on a rest day. */
  runMinutesMin: number | null;
  runMinutesMax: number | null;
  /** "1.5 min jog / 1 min walk x 6" or "12 min continuous". */
  structure: string | null;
  reason: string;
  /** Rest days: first day running can resume. */
  resumeOn: IsoDate | null;
};

type WalkJogSettings = Pick<ProgramSettings, "walkJogRestDays">;

/**
 * The stage ladder (program v2): 1:1 x6, 2:1 x6, 3:1 x5, 5:1 x4, then 10, 15,
 * 20 and 30 min continuous. One stage per session, and only after a normal
 * knee check the next morning.
 */
export const WALK_JOG_STAGES = [
  { phase: "interval", jogMin: 1, walkMin: 1, rounds: 6, runMinutes: 6 },
  { phase: "interval", jogMin: 2, walkMin: 1, rounds: 6, runMinutes: 12 },
  { phase: "interval", jogMin: 3, walkMin: 1, rounds: 5, runMinutes: 15 },
  { phase: "interval", jogMin: 5, walkMin: 1, rounds: 4, runMinutes: 20 },
  { phase: "continuous", jogMin: 10, walkMin: 0, rounds: 1, runMinutes: 10 },
  { phase: "continuous", jogMin: 15, walkMin: 0, rounds: 1, runMinutes: 15 },
  { phase: "continuous", jogMin: 20, walkMin: 0, rounds: 1, runMinutes: 20 },
  { phase: "continuous", jogMin: 30, walkMin: 0, rounds: 1, runMinutes: 30 },
] as const;

export type WalkJogStage = (typeof WALK_JOG_STAGES)[number];
type Phase = WalkJogStage["phase"];
const FIRST_CONTINUOUS = 4;
const LAST_STAGE = WALK_JOG_STAGES.length - 1;

function phaseOf(run: WalkJogRun): Phase {
  if (run.walkMinutes != null && run.walkMinutes > 0) return "interval";
  return run.runMinutes >= 10 ? "continuous" : "interval";
}

/** The stage a logged run reached: the highest one at or below its running minutes. */
export function walkJogStageOf(run: WalkJogRun): number {
  const phase = phaseOf(run);
  let index = phase === "interval" ? 0 : FIRST_CONTINUOUS;
  WALK_JOG_STAGES.forEach((stage, i) => {
    if (stage.phase === phase && stage.runMinutes <= run.runMinutes) index = i;
  });
  return index;
}

export function walkJogStageLabel(index: number) {
  const stage = WALK_JOG_STAGES[Math.min(Math.max(0, index), LAST_STAGE)];
  return stage.phase === "continuous"
    ? `${stage.jogMin} min continuous`
    : `${stage.jogMin} min jog / ${stage.walkMin} min walk x ${stage.rounds}`;
}

function advice(
  index: number,
  reason: string,
  action: WalkJogAdvice["action"] = "run",
): WalkJogAdvice {
  const stage = WALK_JOG_STAGES[index];
  return {
    action,
    stage: index,
    runMinutesMin: stage.runMinutes,
    runMinutesMax: stage.runMinutes,
    structure: walkJogStageLabel(index),
    reason,
    resumeOn: null,
  };
}

/**
 * Next walk-jog, from the logged runs and morning knee checks:
 * - No runs yet: stage 1 (1 min jog / 1 min walk x 6).
 * - The first knee check after the last run was normal: next stage (one
 *   per session); 30 min continuous is the top (from week 23 the weekly 10%
 *   rule takes over).
 * - It was not normal: no running for 2 days after that check (bike
 *   instead), then one stage back (never below the first).
 * - No check since the last run: repeat its stage.
 */
export function walkJogAdvice(input: {
  runs: WalkJogRun[];
  checks: { date: IsoDate; status: KneeReadinessStatus | null }[];
  today: IsoDate;
  settings?: WalkJogSettings;
}): WalkJogAdvice {
  const s = input.settings ?? DEFAULT_PROGRAM_SETTINGS;
  const runs = input.runs
    .filter((r) => r.date < input.today && r.runMinutes > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = runs[0];

  if (!last) return advice(0, "First walk-jog.", "start");

  const current = walkJogStageOf(last);
  const nextCheck = [...input.checks]
    .filter((c) => c.date > last.date && c.status != null)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!nextCheck) {
    return advice(current, "No knee check since the last run: repeat it.");
  }

  if (nextCheck.status === "normal") {
    if (current >= LAST_STAGE) {
      return advice(
        LAST_STAGE,
        "30 min continuous reached. From week 23 grow weekly run minutes by 10% at most.",
      );
    }
    return advice(
      current + 1,
      `Knee was normal after ${walkJogStageLabel(current)}: next stage.`,
    );
  }

  const resumeOn = addDays(nextCheck.date, s.walkJogRestDays + 1);
  if (input.today < resumeOn) {
    return {
      action: "rest",
      stage: null,
      runMinutesMin: null,
      runMinutesMax: null,
      structure: null,
      reason: `Knee check not normal on ${nextCheck.date}: no running for ${s.walkJogRestDays} days, bike instead.`,
      resumeOn,
    };
  }

  return advice(
    Math.max(0, current - 1),
    "Back after a non-normal knee check: one stage back.",
  );
}
