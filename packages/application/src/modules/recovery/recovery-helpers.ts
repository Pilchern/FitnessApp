import type { RecoveryCheckin } from "@fitness-app/domain";
import { buildSparseTrendSeries } from "../../shared/trend-series";

export type RecoveryCoachingSuggestion = {
  severity: "warning" | "info";
  headline: string;
  detail: string;
};

export function getRecoveryCoachingSuggestion(
  recentCheckins: RecoveryCheckin[],
): RecoveryCoachingSuggestion | null {
  if (recentCheckins.length === 0) return null;

  const latest = recentCheckins[0];

  if (latest.readinessLevel != null && latest.readinessLevel <= 3) {
    return {
      severity: "warning",
      headline: "Low readiness today",
      detail:
        "Consider rest or an easy Zone 2 session — pushing hard on low readiness increases injury risk.",
    };
  }

  if (latest.readinessLevel === 4) {
    return {
      severity: "warning",
      headline: "Below-average readiness",
      detail:
        "A Zone 2 ride or walk today would be more productive than a hard session.",
    };
  }

  if (latest.hrv != null && recentCheckins.length >= 2) {
    const hrvValues = recentCheckins
      .map((c) => c.hrv)
      .filter((v): v is number => v != null);

    if (hrvValues.length >= 2) {
      const avgHrv = hrvValues.reduce((sum, v) => sum + v, 0) / hrvValues.length;
      if (latest.hrv < avgHrv * 0.8) {
        return {
          severity: "info",
          headline: "HRV dip today",
          detail:
            "Your HRV is down today. Easy aerobic work or mobility instead of intensity.",
        };
      }
    }
  }

  return null;
}

export type RecoverySummary = {
  averageSleepHours: number | null;
  averageSleepEfficiency: number | null;
  averageReadiness: number | null;
  averageStress: number | null;
  averageSoreness: number | null;
  totalAlcoholCount: number;
  averageRestingHeartRate: number | null;
  averageHrv: number | null;
};

export function buildRecoverySummary(
  checkins: RecoveryCheckin[],
): RecoverySummary {
  const average = (values: number[]) =>
    values.length > 0
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) /
        10
      : null;

  const sleepHoursValues = checkins
    .map((checkin) =>
      checkin.sleepDurationMinutes != null ? checkin.sleepDurationMinutes / 60 : null,
    )
    .filter((value): value is number => value != null);

  const readinessValues = checkins
    .map((checkin) => checkin.readinessLevel)
    .filter((value): value is number => value != null);

  const stressValues = checkins
    .map((checkin) => checkin.stressLevel)
    .filter((value): value is number => value != null);

  const sorenessValues = checkins
    .map((checkin) => checkin.sorenessLevel)
    .filter((value): value is number => value != null);

  const restingHeartRates = checkins
    .map((checkin) => checkin.restingHeartRate)
    .filter((value): value is number => value != null);

  const sleepEfficiencyValues = checkins
    .map((checkin) => checkin.sleepEfficiencyPct)
    .filter((value): value is number => value != null);

  const hrvValues = checkins
    .map((checkin) => checkin.hrv)
    .filter((value): value is number => value != null);

  return {
    averageSleepHours: average(sleepHoursValues),
    averageSleepEfficiency: average(sleepEfficiencyValues),
    averageReadiness: average(readinessValues),
    averageStress: average(stressValues),
    averageSoreness: average(sorenessValues),
    totalAlcoholCount: checkins.reduce(
      (sum, checkin) => sum + checkin.alcoholCount,
      0,
    ),
    averageRestingHeartRate: average(restingHeartRates),
    averageHrv: average(hrvValues),
  };
}

export function buildRecoverySleepTrend(checkins: RecoveryCheckin[]) {
  return buildSparseTrendSeries(
    checkins,
    (checkin) => checkin.checkinDate,
    (checkin) =>
      checkin.sleepDurationMinutes != null
        ? Math.round((checkin.sleepDurationMinutes / 60) * 10) / 10
        : null,
  );
}

export function buildRecoveryRestingHeartRateTrend(checkins: RecoveryCheckin[]) {
  return buildSparseTrendSeries(
    checkins,
    (checkin) => checkin.checkinDate,
    (checkin) => checkin.restingHeartRate,
  );
}

export function buildRecoveryHrvTrend(checkins: RecoveryCheckin[]) {
  return buildSparseTrendSeries(
    checkins,
    (checkin) => checkin.checkinDate,
    (checkin) => checkin.hrv,
  );
}
