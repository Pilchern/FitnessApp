import type {
  CardioSession,
  CardioSessionCompletion,
} from "@fitness-app/domain";

export type CardioWeeklyTotals = {
  completedSessions: number;
  totalMinutes: number;
  zone2Minutes: number;
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
    vo2Sessions: completedSessions.filter(
      (session) => session.sessionKind === "vo2",
    ).length,
    averageHeartRate,
  };
}
