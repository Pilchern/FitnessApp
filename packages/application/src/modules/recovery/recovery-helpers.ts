import type { RecoveryCheckin } from "@fitness-app/domain";
import { buildSparseTrendSeries } from "../../shared/trend-series";

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
