const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The calendar date of a *zoned* instant (one produced by `getZonedDate`,
 * whose UTC fields carry the user's local wall-clock time).
 *
 * Callers must not pass a raw `new Date()`: `toISOString()` on a raw instant
 * yields the UTC date, which rolls over before local midnight for users west
 * of UTC (19:00 in America/Chicago). Anything keyed on "today" — journal
 * streaks, this-week volume — is wrong every evening if it does.
 */
export function formatZonedIsoDate(zonedNow: Date) {
  return zonedNow.toISOString().slice(0, 10);
}

function isoDateAtNoonUtc(isoDate: string) {
  return Date.parse(`${isoDate}T12:00:00Z`);
}

export type WeekPlanTemplate = {
  id: string;
  name: string;
  templateType: "strength" | "cardio";
  scheduledDayOfWeek: number | null;
  definition: unknown;
};

export type WeekPlanSession = {
  sessionDate: string;
  trainingTemplateId: string | null;
};

export type WeekPlanCardioSession = WeekPlanSession & {
  plannedVsCompleted: string;
  sessionKind: string;
};

export type WeekPlanItem = {
  templateId: string;
  name: string;
  kind: "strength" | "cardio";
  targetZone2Minutes: number | null;
  done: boolean;
};

export type WeekPlanDay = {
  date: string;
  dayOfWeek: number;
  isToday: boolean;
  isPast: boolean;
  items: WeekPlanItem[];
};

export type WeekPlan = {
  days: WeekPlanDay[];
  /** Sum of targetZone2Minutes over the cardio templates scheduled this week. */
  zone2TargetMinutes: number;
};

const LEADING_DAY =
  /^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|rsday|urday)?\.?\s+(?=\S)/i;

/**
 * Template names start with their weekday ("Mon Heavy legs + Push"). Lists
 * that already show the day drop it, so the row doesn't read "Mon Mon ...".
 */
export function stripDayPrefix(name: string): string {
  return name.replace(LEADING_DAY, "");
}

function readTargetZone2Minutes(definition: unknown): number | null {
  if (typeof definition !== "object" || definition === null) return null;
  const value = (definition as { targetZone2Minutes?: unknown })
    .targetZone2Minutes;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Lays scheduled templates over the 7 calendar days starting at `weekStart`
 * and marks each done when a matching session exists. A session matches by
 * template id, or by date alone when it was logged without a template.
 * Planned-only cardio rows never count as done.
 */
export function buildWeekPlan(input: {
  weekStart: string;
  today: string;
  templates: WeekPlanTemplate[];
  strengthSessions: WeekPlanSession[];
  cardioSessions: WeekPlanCardioSession[];
}): WeekPlan {
  const days: WeekPlanDay[] = [];
  let zone2TargetMinutes = 0;

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(isoDateAtNoonUtc(input.weekStart) + i * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    const dayOfWeek = new Date(isoDateAtNoonUtc(date)).getUTCDay();
    const items: WeekPlanItem[] = input.templates
      .filter((t) => t.scheduledDayOfWeek === dayOfWeek)
      .map((t) => {
        const kind = t.templateType;
        const done =
          kind === "strength"
            ? input.strengthSessions.some(
                (s) =>
                  s.sessionDate === date &&
                  (s.trainingTemplateId === t.id ||
                    s.trainingTemplateId === null),
              )
            : input.cardioSessions.some(
                (s) =>
                  s.sessionDate === date &&
                  s.plannedVsCompleted === "completed" &&
                  s.sessionKind !== "other" &&
                  (s.trainingTemplateId === t.id ||
                    s.trainingTemplateId === null),
              );
        const targetZone2Minutes =
          kind === "cardio" ? readTargetZone2Minutes(t.definition) : null;
        if (targetZone2Minutes) zone2TargetMinutes += targetZone2Minutes;
        return {
          templateId: t.id,
          name: t.name,
          kind,
          targetZone2Minutes,
          done,
        };
      });
    days.push({
      date,
      dayOfWeek,
      isToday: date === input.today,
      isPast: date < input.today,
      items,
    });
  }

  // A session on a day with nothing of its kind scheduled (a moved lift or
  // ride) completes the earliest missed slot of that kind on or before it.
  // This matches the weekly score, which counts sessions in the week.
  const weekDates = new Set(days.map((d) => d.date));
  const moved = [
    ...input.strengthSessions.map((s) => ({ ...s, kind: "strength" })),
    ...input.cardioSessions
      .filter(
        (s) =>
          s.plannedVsCompleted === "completed" && s.sessionKind !== "other",
      )
      .map((s) => ({ ...s, kind: "cardio" })),
  ]
    .filter(
      (s) =>
        weekDates.has(s.sessionDate) &&
        !days.some(
          (d) =>
            d.date === s.sessionDate &&
            d.items.some((item) => item.kind === s.kind),
        ),
    )
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  for (const session of moved) {
    const slot = days
      .filter((d) => d.date <= session.sessionDate)
      .flatMap((d) => d.items)
      .find((item) => item.kind === session.kind && !item.done);
    if (slot) slot.done = true;
  }

  return { days, zone2TargetMinutes };
}

/** Calendar-date arithmetic on YYYY-MM-DD strings, immune to DST and timezone. */
export function addDaysIsoDate(isoDate: string, days: number) {
  return new Date(isoDateAtNoonUtc(isoDate) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** Today's synced steps and the most recent VO2 max reading, with its date. */
export function summarizeDailyActivity(
  metrics: {
    metricDate: string;
    steps: number | null;
    vo2Max: number | null;
  }[],
  today: string,
): {
  stepsToday: number | null;
  vo2Max: { value: number; date: string } | null;
} {
  const stepsToday = metrics.find((m) => m.metricDate === today)?.steps ?? null;
  const latestVo2 = metrics
    .filter((m) => m.vo2Max != null && m.metricDate <= today)
    .sort((a, b) => b.metricDate.localeCompare(a.metricDate))[0];
  return {
    stepsToday,
    vo2Max:
      latestVo2?.vo2Max != null
        ? { value: latestVo2.vo2Max, date: latestVo2.metricDate }
        : null,
  };
}

export type ReadinessLevelOrNone = "good" | "fair" | "low" | null;

/**
 * One line for "what should I do today", from the readiness level and what the
 * plan has scheduled. Load advice follows the plan's rule (add load only when
 * the top of the range was hit); a low day trims accessories first, which is
 * the plan's own "short on time" order. Never suggests extra lower-body work.
 */
export function readinessCall(
  level: ReadinessLevelOrNone,
  todayItems: Pick<WeekPlanItem, "kind" | "done">[],
  options: { holdProgression?: boolean } = {},
): string {
  const pending = todayItems.filter((i) => !i.done);
  if (todayItems.length > 0 && pending.length === 0) {
    return "Today's session is done. Recover well tonight.";
  }
  const kind = pending.some((i) => i.kind === "strength")
    ? "strength"
    : pending.some((i) => i.kind === "cardio")
      ? "cardio"
      : "rest";

  if (level === null) {
    if (kind === "strength") return "Lift as planned.";
    if (kind === "cardio") return "Ride as planned.";
    return "Nothing scheduled today.";
  }

  // Resting HR up this week: a good score still holds the ride (plan section 5).
  if (level === "good" && kind === "cardio" && options.holdProgression) {
    return "Resting HR is up this week: ride at last ride's settings, 125-144 bpm. No progression.";
  }

  const calls: Record<
    "good" | "fair" | "low",
    Record<"strength" | "cardio" | "rest", string>
  > = {
    good: {
      strength:
        "Good day to lift. Add load where you hit the top of the range last time.",
      cardio:
        "Ride. Knee fine this morning? Make one change: cadence first, then 2-3 points of resistance.",
      rest: "Rest day: 45-60 min outdoor walk.",
    },
    fair: {
      strength: "Lift as planned, at the weights you used last time.",
      cardio: "Ride at last ride's settings, 125-144 bpm. No progression.",
      rest: "Rest day: an easy 45-60 min walk.",
    },
    low: {
      strength:
        "Go light: main lifts only, cut the accessories. Knee block and PT sheet as usual.",
      cardio:
        "Ride easy at your last good settings, or shorten it. No progression.",
      rest: "Rest day. Easy walk, protect tonight's sleep.",
    },
  };
  return calls[level][kind];
}
