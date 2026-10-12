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
      bedtimeLocal: "",
      wakeTimeLocal: "",
      sleepQuality: "",
      readinessLevel: "",
      energyLevel: "",
      stressLevel: "",
      sorenessLevel: "",
      alcoholCount: "0",
      restingHeartRate: "",
      hrv: "",
      coldPlungeCompleted: false,
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
    bedtimeLocal: checkin.bedtimeLocal ?? "",
    wakeTimeLocal: checkin.wakeTimeLocal ?? "",
    sleepQuality: numberToInput(checkin.sleepQuality),
    readinessLevel: numberToInput(checkin.readinessLevel),
    energyLevel: numberToInput(checkin.energyLevel),
    stressLevel: numberToInput(checkin.stressLevel),
    sorenessLevel: numberToInput(checkin.sorenessLevel),
    alcoholCount: `${checkin.alcoholCount}`,
    restingHeartRate: numberToInput(checkin.restingHeartRate),
    hrv: numberToInput(checkin.hrv),
    coldPlungeCompleted: checkin.coldPlungeCompleted ?? false,
    notes: checkin.notes ?? "",
  };
}

type RecoveryPayloadFields = Pick<
  RecoveryCheckin,
  | "sleepDurationMinutes"
  | "bedtimeLocal"
  | "wakeTimeLocal"
  | "sleepQuality"
  | "readinessLevel"
  | "energyLevel"
  | "stressLevel"
  | "sorenessLevel"
  | "restingHeartRate"
  | "hrv"
  | "coldPlungeCompleted"
  | "notes"
>;

/**
 * A check-in saved for a date that already has a row (usually the one Apple
 * Health created overnight) updates that row instead of adding a second one.
 * Blank fields keep what is stored, so synced sleep and heart rate survive.
 */
export function mergeIntoExistingCheckin<T extends RecoveryPayloadFields>(
  payload: T,
  existing: RecoveryCheckin,
): Omit<T, keyof RecoveryPayloadFields> &
  RecoveryPayloadFields & { id: string } {
  return {
    ...payload,
    id: existing.id,
    sleepDurationMinutes:
      payload.sleepDurationMinutes ?? existing.sleepDurationMinutes,
    bedtimeLocal: payload.bedtimeLocal ?? existing.bedtimeLocal,
    wakeTimeLocal: payload.wakeTimeLocal ?? existing.wakeTimeLocal,
    sleepQuality: payload.sleepQuality ?? existing.sleepQuality,
    readinessLevel: payload.readinessLevel ?? existing.readinessLevel,
    energyLevel: payload.energyLevel ?? existing.energyLevel,
    stressLevel: payload.stressLevel ?? existing.stressLevel,
    sorenessLevel: payload.sorenessLevel ?? existing.sorenessLevel,
    restingHeartRate: payload.restingHeartRate ?? existing.restingHeartRate,
    hrv: payload.hrv ?? existing.hrv,
    // An unticked box is indistinguishable from "not answered" here.
    coldPlungeCompleted:
      payload.coldPlungeCompleted || existing.coldPlungeCompleted,
    notes: payload.notes ?? existing.notes,
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

/**
 * Editing a synced row must not quietly rewrite what the sync wrote. The form
 * shows sleep rounded to 0.1 h, so an unchanged field would save 437 min back
 * as 438; keep the stored minutes when the hours still match. And keep the
 * provider fields, marking the row mixed, so its Apple Health origin survives.
 */
export function keepSyncedValues<
  T extends {
    sleepDurationMinutes: number | null;
    source: RecoveryCheckin["source"];
  },
>(
  payload: T,
  existing: RecoveryCheckin,
): Omit<T, "source"> & { source: RecoveryCheckin["source"] } {
  const shownHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
  const sleepUnchanged =
    payload.sleepDurationMinutes != null &&
    existing.sleepDurationMinutes != null &&
    shownHours(payload.sleepDurationMinutes) ===
      shownHours(existing.sleepDurationMinutes);
  const synced = existing.source.sourceType !== "manual";
  return {
    ...payload,
    sleepDurationMinutes: sleepUnchanged
      ? existing.sleepDurationMinutes
      : payload.sleepDurationMinutes,
    source:
      synced && existing.source.sourceProvider != null
        ? {
            ...existing.source,
            sourceType: "mixed" as const,
            sourceProvider: existing.source.sourceProvider,
          }
        : payload.source,
  };
}
