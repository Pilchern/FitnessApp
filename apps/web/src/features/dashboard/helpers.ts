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
