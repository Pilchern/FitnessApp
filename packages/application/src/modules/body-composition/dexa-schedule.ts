import type { DexaScan, IsoDate } from "@fitness-app/domain";

/** Repeat interval once the listed dates run out. */
export const DEXA_REPEAT_MONTHS = 6;

export const PRE_SCAN_CHECKLIST = [
  "Morning scan",
  "Fasted: water only, no food or coffee",
  "No workout beforehand",
  "Normal hydration, nothing unusual the day before",
  "Same location and machine as last time",
] as const;

export const DEFAULT_DEXA_NEXT_DATES = "2027-01-16, 2027-04-16";

function daysBetween(from: IsoDate, to: IsoDate) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

function addMonths(date: IsoDate, months: number): IsoDate {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** "2027-01-16, 2027-04-16" -> sorted valid dates. */
export function parseDexaDates(text: string | null | undefined): IsoDate[] {
  return (text ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        !Number.isNaN(Date.parse(`${s}T12:00:00Z`)),
    )
    .sort();
}

export type NextDexaScan = {
  date: IsoDate;
  daysAway: number;
  /** The scan after it, when one is listed. */
  following: IsoDate | null;
  /** From the setting, or counted 6 months on from the newest scan. */
  basis: "planned" | "every_6_months";
  facility: string | null;
  machine: string | null;
};

/**
 * The next scan on or after today. Listed dates first; past the last one,
 * 6 months after the newest scan (or the last listed date), stepping on
 * until it is in the future.
 */
export function nextDexaScan(input: {
  plannedDates: IsoDate[];
  scans: Pick<DexaScan, "scanDate" | "facility" | "machine">[];
  today: IsoDate;
}): NextDexaScan | null {
  const latest =
    [...input.scans]
      .sort((a, b) => a.scanDate.localeCompare(b.scanDate))
      .at(-1) ?? null;
  const upcoming = input.plannedDates.filter((d) => d >= input.today);
  let date: IsoDate | null = upcoming[0] ?? null;
  let following: IsoDate | null = upcoming[1] ?? null;
  let basis: NextDexaScan["basis"] = "planned";
  if (!date) {
    const anchor = [latest?.scanDate, input.plannedDates.at(-1)]
      .filter((d): d is IsoDate => d != null)
      .sort()
      .at(-1);
    if (!anchor) return null;
    date = addMonths(anchor, DEXA_REPEAT_MONTHS);
    while (date < input.today) date = addMonths(date, DEXA_REPEAT_MONTHS);
    following = addMonths(date, DEXA_REPEAT_MONTHS);
    basis = "every_6_months";
  } else if (!following) {
    following = addMonths(date, DEXA_REPEAT_MONTHS);
  }
  return {
    date,
    daysAway: daysBetween(input.today, date),
    following,
    basis,
    facility: latest?.facility ?? null,
    machine: latest?.machine ?? null,
  };
}
