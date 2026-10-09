import type { GoalProgress } from "./types";

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

export type GoalProgressProfile = {
  goalFatLoss: boolean;
  goalPreserveMuscle: boolean;
  goalImproveVo2: boolean;
  targetWeightLb: number | null;
  targetDate: string | null;
};

export type GoalProgressBodyMetric = {
  measuredOn: string;
  weightLb: number | null;
};

export type GoalProgressStrengthSession = {
  sessionDate: string;
  sets: { weight: number | null; reps: number | null }[];
};

export type GoalProgressCardioSession = {
  sessionDate: string;
  sessionKind: string;
  zone2Minutes: number | null;
  durationMinutes: number | null;
};

export type GoalProgressOptions = {
  /**
   * "Now" in the user's timezone, as produced by `getZonedDate(timezone)`:
   * a Date whose UTC fields carry the user's local wall-clock time. All day
   * boundaries below are derived from it, so they line up with the user's
   * calendar rather than UTC's. Defaults to the raw current instant (UTC).
   */
  zonedNow?: Date;
};

export function computeGoalProgress(
  profile: GoalProgressProfile | null,
  recentBody: GoalProgressBodyMetric[],
  strengthSessions: GoalProgressStrengthSession[],
  cardioLast8Weeks: GoalProgressCardioSession[],
  options: GoalProgressOptions = {},
): GoalProgress[] {
  if (!profile) return [];

  // All date arithmetic below uses UTC getters/setters on the zoned instant,
  // so the resulting day boundaries are the user's local calendar days.
  const now = options.zonedNow ?? new Date();

  function daysAgoStr(days: number) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  }

  const progress: GoalProgress[] = [];

  if (profile.goalFatLoss) {
    const cutoff = daysAgoStr(28);
    const sorted = [...recentBody]
      .filter((r) => r.weightLb != null)
      .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn));
    const latest = sorted[0] ?? null;
    const baseline = sorted.find((r) => r.measuredOn <= cutoff) ?? null;

    if (!latest || !baseline) {
      progress.push({
        label: "Fat loss",
        description: "Trending body weight down over time",
        trend: "insufficient_data",
        trendDetail: "Not enough data yet — keep logging",
      });
    } else {
      const delta = (latest.weightLb ?? 0) - (baseline.weightLb ?? 0);
      const absDelta = Math.abs(delta).toFixed(1);
      const trend =
        delta <= -0.5 ? "improving" : delta >= 1 ? "declining" : "maintaining";

      // The baseline is the most recent weigh-in at or before 28 days ago, but
      // the metric list spans 90 days — so the span between baseline and latest
      // can be far longer than 4 weeks. Measure it instead of assuming it.
      const elapsedWeeks =
        (isoDateAtNoonUtc(latest.measuredOn) -
          isoDateAtNoonUtc(baseline.measuredOn)) /
        (7 * MS_PER_DAY);
      const hasUsableSpan =
        Number.isFinite(elapsedWeeks) && elapsedWeeks >= 0.5;
      const spanWeeks = hasUsableSpan
        ? Math.max(1, Math.round(elapsedWeeks))
        : 0;

      const targetWeightLb = profile.targetWeightLb;
      if (targetWeightLb != null && latest.weightLb != null) {
        const remaining = latest.weightLb - targetWeightLb;

        if (remaining <= 0) {
          progress.push({
            label: "Fat loss",
            description: `Target weight: ${targetWeightLb}lb`,
            trend: "improving",
            trendDetail: `At or below target (${latest.weightLb}lb)`,
          });
        } else {
          let paceDetail = "";
          if (profile.targetDate) {
            const weeksRemaining =
              (isoDateAtNoonUtc(profile.targetDate) - now.getTime()) /
              (7 * MS_PER_DAY);
            if (weeksRemaining <= 0) {
              paceDetail = ` — target date (${profile.targetDate}) has passed`;
            } else if (!hasUsableSpan) {
              paceDetail = ` — not enough weigh-in history to judge pace for ${profile.targetDate}`;
            } else {
              const requiredWeeklyRate = remaining / weeksRemaining;
              const actualWeeklyRate = -delta / elapsedWeeks;
              paceDetail =
                actualWeeklyRate >= requiredWeeklyRate
                  ? ` — on pace for ${profile.targetDate}`
                  : ` — behind pace for ${profile.targetDate}`;
            }
          }
          progress.push({
            label: "Fat loss",
            description: `Target weight: ${targetWeightLb}lb`,
            trend,
            trendDetail: `${remaining.toFixed(1)}lb to go${paceDetail}`,
          });
        }
      } else {
        const spanLabel = hasUsableSpan
          ? `in ${spanWeeks} ${spanWeeks === 1 ? "week" : "weeks"}`
          : "since your last weigh-in";
        progress.push({
          label: "Fat loss",
          description: "Trending body weight down over time",
          trend,
          trendDetail: `${delta < 0 ? "down" : "up"} ${absDelta}lb ${spanLabel}`,
        });
      }
    }
  }

  if (profile.goalPreserveMuscle) {
    const thisMonthStart = daysAgoStr(30);
    const lastMonthStart = daysAgoStr(60);

    function sessionVolume(s: GoalProgressStrengthSession) {
      return s.sets.reduce(
        (sum, set) =>
          sum +
          (set.weight != null && set.reps != null ? set.weight * set.reps : 0),
        0,
      );
    }

    const thisMonth = strengthSessions.filter(
      (s) => s.sessionDate >= thisMonthStart,
    );
    const lastMonth = strengthSessions.filter(
      (s) => s.sessionDate >= lastMonthStart && s.sessionDate < thisMonthStart,
    );
    const thisVol = thisMonth.reduce((sum, s) => sum + sessionVolume(s), 0);
    const lastVol = lastMonth.reduce((sum, s) => sum + sessionVolume(s), 0);

    if (thisMonth.length === 0 || lastMonth.length === 0) {
      progress.push({
        label: "Preserve muscle",
        description: "Maintaining strength training volume month over month",
        trend: "insufficient_data",
        trendDetail: "Not enough data yet — keep logging",
      });
    } else {
      const pct = lastVol > 0 ? ((thisVol - lastVol) / lastVol) * 100 : 0;
      progress.push({
        label: "Preserve muscle",
        description: "Maintaining strength training volume month over month",
        trend:
          pct >= 5 ? "improving" : pct <= -10 ? "declining" : "maintaining",
        trendDetail:
          pct >= 0
            ? `volume up ${pct.toFixed(0)}% vs last month`
            : `volume down ${Math.abs(pct).toFixed(0)}% vs last month`,
      });
    }
  }

  if (profile.goalImproveVo2) {
    const fourWeeksAgo = daysAgoStr(28);
    const eightWeeksAgo = daysAgoStr(56);
    const today = daysAgoStr(0);

    function minutesIn(
      sessions: GoalProgressCardioSession[],
      inWindow: (sessionDate: string) => boolean,
    ): number {
      return sessions
        .filter((s) => inWindow(s.sessionDate))
        .reduce((sum, s) => {
          if (s.sessionKind === "zone2" || s.sessionKind === "vo2") {
            return sum + (s.zone2Minutes ?? s.durationMinutes ?? 0);
          }
          return sum;
        }, 0);
    }

    // Half-open boundary, matching the muscle branch: the prior window stops
    // *before* fourWeeksAgo so a session on that day is counted exactly once.
    const thisMinutes = minutesIn(
      cardioLast8Weeks,
      (d) => d >= fourWeeksAgo && d <= today,
    );
    const priorMinutes = minutesIn(
      cardioLast8Weeks,
      (d) => d >= eightWeeksAgo && d < fourWeeksAgo,
    );
    const thisPerWeek = thisMinutes / 4;
    const priorPerWeek = priorMinutes / 4;
    const delta = thisPerWeek - priorPerWeek;

    if (priorMinutes === 0 && thisMinutes === 0) {
      progress.push({
        label: "Improve VO2",
        description: "Increasing Zone 2 + VO2 cardio minutes per week",
        trend: "insufficient_data",
        trendDetail: "Not enough data yet — keep logging",
      });
    } else {
      const absDelta = Math.abs(delta).toFixed(0);
      progress.push({
        label: "Improve VO2",
        description: "Increasing Zone 2 + VO2 cardio minutes per week",
        trend:
          delta >= 20
            ? "improving"
            : delta <= -20
              ? "declining"
              : "maintaining",
        trendDetail:
          delta >= 0
            ? `up ${absDelta} min/week vs prior 4 weeks`
            : `down ${absDelta} min/week vs prior 4 weeks`,
      });
    }
  }

  return progress;
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
