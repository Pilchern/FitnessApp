import type { GoalProgress } from "./types";

type ProfileGoals = {
  goalFatLoss: boolean;
  goalPreserveMuscle: boolean;
  goalImproveVo2: boolean;
};

type BodyEntry = { measuredOn: string; weightLb: number | null };
type StrengthEntry = { sessionDate: string; sets: { weight: number | null; reps: number | null }[] };
type CardioEntry = {
  sessionDate: string;
  sessionKind: string;
  zone2Minutes: number | null;
  durationMinutes: number | null;
};

export function computeGoalProgress(
  profile: ProfileGoals | null,
  recentBody: BodyEntry[],
  strengthSessions: StrengthEntry[],
  cardioLast8Weeks: CardioEntry[],
  now: Date = new Date(),
): GoalProgress[] {
  if (!profile) return [];

  function daysAgoStr(days: number) {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
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
      progress.push({
        label: "Fat loss",
        description: "Trending body weight down over time",
        trend: delta <= -0.5 ? "improving" : delta >= 1 ? "declining" : "maintaining",
        trendDetail: `${delta < 0 ? "down" : "up"} ${absDelta}lb in 4 weeks`,
      });
    }
  }

  if (profile.goalPreserveMuscle) {
    const thisMonthStart = daysAgoStr(30);
    const lastMonthStart = daysAgoStr(60);

    function sessionVolume(s: StrengthEntry) {
      return s.sets.reduce(
        (sum, set) => sum + (set.weight != null && set.reps != null ? set.weight * set.reps : 0),
        0,
      );
    }

    const thisMonth = strengthSessions.filter((s) => s.sessionDate >= thisMonthStart);
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
        trend: pct >= 5 ? "improving" : pct <= -10 ? "declining" : "maintaining",
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

    function rangeMinutes(sessions: CardioEntry[], from: string, to: string): number {
      return sessions
        .filter((s) => s.sessionDate >= from && s.sessionDate <= to)
        .reduce((sum, s) => {
          if (s.sessionKind === "zone2" || s.sessionKind === "vo2") {
            return sum + (s.zone2Minutes ?? s.durationMinutes ?? 0);
          }
          return sum;
        }, 0);
    }

    const thisMinutes = rangeMinutes(cardioLast8Weeks, fourWeeksAgo, today);
    const priorMinutes = rangeMinutes(cardioLast8Weeks, eightWeeksAgo, daysAgoStr(29));
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
        trend: delta >= 20 ? "improving" : delta <= -20 ? "declining" : "maintaining",
        trendDetail:
          delta >= 0
            ? `up ${absDelta} min/week vs prior 4 weeks`
            : `down ${absDelta} min/week vs prior 4 weeks`,
      });
    }
  }

  return progress;
}
