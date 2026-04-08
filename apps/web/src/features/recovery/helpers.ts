import type { RecoveryCheckin } from "@fitness-app/domain";
import type { RecoveryFormValues } from "./types";

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numberToInput(value: number | null) {
  return value == null ? "" : `${value}`;
}

export function toRecoveryFormValues(
  checkin: RecoveryCheckin | null,
): RecoveryFormValues {
  if (!checkin) {
    return {
      checkinDate: todayIsoDate(),
      sleepHours: "",
      sleepQuality: "",
      readinessLevel: "",
      energyLevel: "",
      stressLevel: "",
      sorenessLevel: "",
      alcoholCount: "0",
      restingHeartRate: "",
      hrv: "",
      notes: "",
    };
  }

  return {
    id: checkin.id,
    checkinDate: checkin.checkinDate,
    sleepHours:
      checkin.sleepDurationMinutes != null
        ? `${Math.round((checkin.sleepDurationMinutes / 60) * 10) / 10}`
        : "",
    sleepQuality: numberToInput(checkin.sleepQuality),
    readinessLevel: numberToInput(checkin.readinessLevel),
    energyLevel: numberToInput(checkin.energyLevel),
    stressLevel: numberToInput(checkin.stressLevel),
    sorenessLevel: numberToInput(checkin.sorenessLevel),
    alcoholCount: `${checkin.alcoholCount}`,
    restingHeartRate: numberToInput(checkin.restingHeartRate),
    hrv: numberToInput(checkin.hrv),
    notes: checkin.notes ?? "",
  };
}

export function formatRecoveryDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatHours(value: number | null) {
  return value == null ? "--" : `${Math.round(value * 10) / 10}h`;
}

export function formatScore(value: number | null, suffix = "/10") {
  return value == null ? "--" : `${value}${suffix}`;
}

export function formatRestingHeartRate(value: number | null) {
  return value == null ? "--" : `${Math.round(value)} bpm`;
}

export function formatSleepEfficiency(pct: number | null): string {
  return pct == null ? "—" : `${Math.round(pct)}%`;
}

export function formatSleepStageMinutes(mins: number | null): string {
  if (mins == null) {
    return "—";
  }

  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatSpO2(pct: number | null): string {
  return pct == null ? "—" : `${pct.toFixed(1)}%`;
}

export function formatRespiratoryRate(rate: number | null): string {
  return rate == null ? "—" : `${rate.toFixed(1)} br/min`;
}
