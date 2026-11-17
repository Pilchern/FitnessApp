import type {
  CardioSession,
  CardioSessionCompletion,
} from "@fitness-app/domain";
import type { SparseTrendPoint } from "../../shared/trend-series";

export type CardioWeeklyTotals = {
  completedSessions: number;
  totalMinutes: number;
  zone2Minutes: number;
  /**
   * Minutes inside the Settings Zone 2 heart rate band on every ride (synced
   * rides measure it from heart rate; a manual Zone 2 ride counts its
   * duration).
   */
  minutesInHrBand: number;
  vo2Sessions: number;
  averageHeartRate: number | null;
};

const completionCountsAsDone = new Set<CardioSessionCompletion>([
  "completed",
  "partial",
]);

export function buildCardioWeeklyTotals(
  sessions: CardioSession[],
): CardioWeeklyTotals {
  const completedSessions = sessions.filter((session) =>
    completionCountsAsDone.has(session.plannedVsCompleted),
  );

  const totalMinutes = completedSessions.reduce(
    (sum, session) => sum + (session.durationMinutes ?? 0),
    0,
  );

  const zone2Minutes = completedSessions.reduce((sum, session) => {
    if (session.sessionKind !== "zone2") {
      return sum;
    }

    return sum + (session.zone2Minutes ?? session.durationMinutes ?? 0);
  }, 0);

  const heartRateSamples = completedSessions
    .map((session) => session.avgHeartRate)
    .filter((value): value is number => value != null);

  const averageHeartRate =
    heartRateSamples.length > 0
      ? Math.round(
          heartRateSamples.reduce((sum, value) => sum + value, 0) /
            heartRateSamples.length,
        )
      : null;

  return {
    completedSessions: completedSessions.length,
    totalMinutes,
    zone2Minutes,
    minutesInHrBand: completedSessions.reduce(
      (sum, session) =>
        sum +
        (session.zone2Minutes ??
          (session.sessionKind === "zone2"
            ? (session.durationMinutes ?? 0)
            : 0)),
      0,
    ),
    vo2Sessions: completedSessions.filter(
      (session) => session.sessionKind === "vo2",
    ).length,
    averageHeartRate,
  };
}

function doneRides(sessions: CardioSession[]) {
  return sessions
    .filter((s) => completionCountsAsDone.has(s.plannedVsCompleted))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

/** Average output (watts) of each Zone 2 ride that has one, oldest first. */
export function zone2OutputTrend(
  sessions: CardioSession[],
): SparseTrendPoint[] {
  return doneRides(sessions)
    .filter((s) => s.sessionKind === "zone2" && s.avgOutput != null)
    .map((s) => ({ date: s.sessionDate, value: Math.round(s.avgOutput!) }));
}

/** Mean of a VO2 ride's interval outputs (watts), oldest first. */
export function intervalOutputTrend(
  sessions: CardioSession[],
): SparseTrendPoint[] {
  return doneRides(sessions).flatMap((s) => {
    const outputs = s.intervalOutputs ?? [];
    if (s.sessionKind !== "vo2" || outputs.length === 0) return [];
    const mean = outputs.reduce((sum, w) => sum + w, 0) / outputs.length;
    return [{ date: s.sessionDate, value: Math.round(mean) }];
  });
}
