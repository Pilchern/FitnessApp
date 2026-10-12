import { describe, expect, it } from "vitest";
import type { RecoveryCheckin } from "@fitness-app/domain";
import { mergeIntoExistingCheckin, toRecoveryFormValues } from "./helpers";

// Synthetic values, shaped like a row the Apple Health sleep sync creates.
const synced = {
  id: "checkin-synced",
  userId: "user-1",
  checkinDate: "2026-10-13",
  restingHeartRate: 55,
  hrv: 48.2,
  sleepDurationMinutes: 430,
  bedtimeLocal: "21:50",
  wakeTimeLocal: "06:10",
  sleepQuality: null,
  energyLevel: null,
  readinessLevel: null,
  stressLevel: null,
  sorenessLevel: null,
  alcoholCount: 0,
  notes: null,
  timeInBedMinutes: 470,
  sleepEfficiencyPct: null,
  deepSleepMinutes: 60,
  remSleepMinutes: 90,
  coreSleepMinutes: 280,
  awakeMinutes: 20,
  sleepRespiratoryRate: null,
  sleepSpo2AvgPct: null,
  sleepHrvAvg: null,
  sleepAvgHeartRate: null,
  coldPlungeCompleted: null,
  source: {
    sourceType: "imported",
    sourceProvider: "apple_health",
    sourceExternalId: "2026-10-13",
    importBatchId: null,
    rawImportEventId: null,
  },
  createdAt: "2026-10-13T11:00:00Z",
  updatedAt: "2026-10-13T11:00:00Z",
  deletedAt: null,
} as RecoveryCheckin;

const blankForm = {
  userId: "user-1",
  checkinDate: "2026-10-13",
  sleepDurationMinutes: null,
  bedtimeLocal: null,
  wakeTimeLocal: null,
  sleepQuality: null,
  readinessLevel: 7,
  energyLevel: null,
  stressLevel: null,
  sorenessLevel: 3,
  alcoholCount: 0,
  restingHeartRate: null,
  hrv: null,
  coldPlungeCompleted: true,
  notes: null,
};

describe("mergeIntoExistingCheckin", () => {
  it("adds the typed fields to the synced row and keeps its sleep and heart rate", () => {
    expect(mergeIntoExistingCheckin(blankForm, synced)).toMatchObject({
      id: "checkin-synced",
      readinessLevel: 7,
      sorenessLevel: 3,
      coldPlungeCompleted: true,
      sleepDurationMinutes: 430,
      bedtimeLocal: "21:50",
      wakeTimeLocal: "06:10",
      restingHeartRate: 55,
      hrv: 48.2,
    });
  });

  it("lets a typed time replace a synced one; an unticked plunge keeps a stored yes", () => {
    expect(
      mergeIntoExistingCheckin(
        { ...blankForm, bedtimeLocal: "21:20", coldPlungeCompleted: false },
        { ...synced, coldPlungeCompleted: true },
      ),
    ).toMatchObject({ bedtimeLocal: "21:20", coldPlungeCompleted: true });
  });
});

describe("toRecoveryFormValues", () => {
  it("prefills the form from a synced row so a save does not blank it", () => {
    expect(toRecoveryFormValues(synced)).toMatchObject({
      id: "checkin-synced",
      sleepHours: "7.2",
      bedtimeLocal: "21:50",
      restingHeartRate: "55",
      hrv: "48.2",
    });
  });
});
