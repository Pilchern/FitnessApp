import type {
  IsoDate,
  ProgramBlock,
  ProgramGate,
  ProgramWeek,
  TrainingProgram,
} from "@fitness-app/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcNoon(isoDate: IsoDate) {
  return Date.parse(`${isoDate}T12:00:00Z`);
}

/** Whole days from `from` to `to` (YYYY-MM-DD), DST-proof. */
export function daysBetween(from: IsoDate, to: IsoDate) {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / DAY_MS);
}

export function addDays(isoDate: IsoDate, days: number): IsoDate {
  return new Date(toUtcNoon(isoDate) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** 0 = Sunday .. 6 = Saturday. */
export function dayOfWeekOf(isoDate: IsoDate) {
  return new Date(toUtcNoon(isoDate)).getUTCDay();
}

/**
 * Post-op week: whole weeks since the anchor (surgery) date. Surgery day
 * through day 6 is week 0, so 2026-10-19 is week 9 for a 2026-08-17 anchor.
 */
export function postOpWeek(anchorDate: IsoDate, date: IsoDate) {
  return Math.floor(daysBetween(anchorDate, date) / 7);
}

/** First and last date of post-op week `week`. */
export function weekDateRange(anchorDate: IsoDate, week: number) {
  const start = addDays(anchorDate, week * 7);
  return { start, end: addDays(start, 6) };
}

/** Cleared from its date on; an unknown gate key stays locked. */
export function isGateCleared(
  gates: Pick<ProgramGate, "gateKey" | "clearedOn">[],
  gateKey: string | null,
  date: IsoDate,
) {
  if (gateKey == null) return true;
  const gate = gates.find((g) => g.gateKey === gateKey);
  return gate?.clearedOn != null && gate.clearedOn <= date;
}

type BlockForSelection = Pick<ProgramBlock, "id" | "startWeek" | "endWeek"> &
  Partial<
    Pick<
      ProgramBlock,
      "activation" | "gateKey" | "fallbackBlockId" | "activatedOn"
    >
  >;

/**
 * The block that runs on `date` (post-op `week`):
 * - A manual block (the triathlon placeholder) runs from its activation
 *   date; the latest activated one wins.
 * - Otherwise the block whose week range holds `week`. A gate block (return
 *   to sport) only runs once its gate is cleared; until then its fallback
 *   block runs (or nothing, without one).
 * Null outside every block.
 */
export function blockForWeek<B extends BlockForSelection>(
  blocks: B[],
  week: number,
  gates: Pick<ProgramGate, "gateKey" | "clearedOn">[] = [],
  date: IsoDate | null = null,
): B | null {
  if (date != null) {
    const manual = blocks
      .filter(
        (b) =>
          b.activation === "manual" &&
          b.activatedOn != null &&
          b.activatedOn <= date,
      )
      .sort((a, b) => (b.activatedOn ?? "").localeCompare(a.activatedOn ?? ""));
    if (manual[0]) return manual[0];
  }
  const inRange =
    [...blocks]
      .filter((b) => b.activation !== "manual")
      .sort((a, b) => a.startWeek - b.startWeek)
      .find((b) => week >= b.startWeek && week <= b.endWeek) ?? null;
  if (!inRange || inRange.activation !== "gate") return inRange;
  if (date != null && isGateCleared(gates, inRange.gateKey ?? null, date)) {
    return inRange;
  }
  return blocks.find((b) => b.id === inRange.fallbackBlockId) ?? null;
}

export function isDeloadWeek(weeks: ProgramWeek[], week: number) {
  return weeks.some((w) => w.weekNumber === week && w.isDeload);
}

export type ProgramWeekInfo = {
  week: number;
  block: ProgramBlock | null;
  isDeload: boolean;
  /** 0 in the block's first week. */
  weekIndexInBlock: number;
  dayOfWeek: number;
  weekStart: IsoDate;
  weekEnd: IsoDate;
};

export function programWeekInfo(
  program: Pick<TrainingProgram, "weekAnchorDate" | "blocks" | "weeks"> &
    Partial<Pick<TrainingProgram, "gates">>,
  date: IsoDate,
): ProgramWeekInfo {
  const week = postOpWeek(program.weekAnchorDate, date);
  const block = blockForWeek(program.blocks, week, program.gates ?? [], date);
  const { start, end } = weekDateRange(program.weekAnchorDate, week);
  return {
    week,
    block,
    isDeload: isDeloadWeek(program.weeks, week),
    weekIndexInBlock: block ? Math.max(0, week - block.startWeek) : 0,
    dayOfWeek: dayOfWeekOf(date),
    weekStart: start,
    weekEnd: end,
  };
}

export type ProgramMilestone = {
  label: string;
  week: number;
  date: IsoDate;
};

/**
 * Each block's first day, then the earliest return-to-sport date (unless a
 * block already starts that week).
 */
export function programMilestones(
  program: Pick<
    TrainingProgram,
    "weekAnchorDate" | "blocks" | "returnToSportWeek"
  >,
): ProgramMilestone[] {
  const milestones = [...program.blocks]
    .filter((b) => b.activation !== "manual")
    .sort((a, b) => a.startWeek - b.startWeek)
    .map((b) => ({
      label: b.name,
      week: b.startWeek,
      date: weekDateRange(program.weekAnchorDate, b.startWeek).start,
    }));
  // A block that starts on the return-to-sport week already marks it.
  if (
    program.returnToSportWeek != null &&
    !program.blocks.some((b) => b.startWeek === program.returnToSportWeek)
  ) {
    milestones.push({
      label: "Return to sport (earliest)",
      week: program.returnToSportWeek,
      date: weekDateRange(program.weekAnchorDate, program.returnToSportWeek)
        .start,
    });
  }
  return milestones;
}
