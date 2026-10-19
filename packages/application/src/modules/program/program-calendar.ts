import type {
  IsoDate,
  ProgramBlock,
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

/** The block whose week range holds `week`; null outside every block. */
export function blockForWeek(
  blocks: ProgramBlock[],
  week: number,
): ProgramBlock | null {
  return (
    [...blocks]
      .sort((a, b) => a.startWeek - b.startWeek)
      .find((b) => week >= b.startWeek && week <= b.endWeek) ?? null
  );
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
  program: Pick<TrainingProgram, "weekAnchorDate" | "blocks" | "weeks">,
  date: IsoDate,
): ProgramWeekInfo {
  const week = postOpWeek(program.weekAnchorDate, date);
  const block = blockForWeek(program.blocks, week);
  const { start, end } = weekDateRange(program.weekAnchorDate, week);
  return {
    week,
    block,
    isDeload: isDeloadWeek(program.weeks, week),
    weekIndexInBlock: block ? week - block.startWeek : 0,
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
