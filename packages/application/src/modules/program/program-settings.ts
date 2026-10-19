import type { TrainingSetting } from "@fitness-app/domain";

/**
 * Every program target and threshold. The values live in `training_settings`
 * (seeded, edited in Settings); these defaults only fill a key whose row is
 * missing, so a fresh database still works.
 */
export type ProgramSettings = {
  barbellStepLb: number;
  dumbbellFineStepLb: number;
  dumbbellFineLimitLb: number;
  dumbbellCoarseStepLb: number;
  cuffStepLb: number;
  progressionMinRir: number;
  sleepMinHoursForIncrease: number;
  sleepAverageNights: number;
  hardSetMaxRir: number;
  quadSetsMin: number;
  quadSetsMax: number;
  readinessNormalMaxPain: number;
  readinessKneeOffAbovePain: number;
  kneeOffStreakDays: number;
  kneeOffBlockMinutes: number;
  orthoName: string;
  orthoPhone: string | null;
  walkJogStartRunMin: number;
  walkJogStartWalkMin: number;
  walkJogStartRounds: number;
  walkJogStepMin: number;
  walkJogStepMax: number;
  walkJogRestDays: number;
  rideAfterWalkJogMin: number;
  rideAfterWalkJogMax: number;
};

export const DEFAULT_PROGRAM_SETTINGS: ProgramSettings = {
  barbellStepLb: 5,
  dumbbellFineStepLb: 2.5,
  dumbbellFineLimitLb: 25,
  dumbbellCoarseStepLb: 5,
  cuffStepLb: 2.5,
  progressionMinRir: 2,
  sleepMinHoursForIncrease: 6.5,
  sleepAverageNights: 3,
  hardSetMaxRir: 4,
  quadSetsMin: 12,
  quadSetsMax: 16,
  readinessNormalMaxPain: 2,
  readinessKneeOffAbovePain: 3,
  kneeOffStreakDays: 2,
  kneeOffBlockMinutes: 15,
  orthoName: "OrthoIllinois",
  orthoPhone: null,
  walkJogStartRunMin: 1,
  walkJogStartWalkMin: 1,
  walkJogStartRounds: 6,
  walkJogStepMin: 1,
  walkJogStepMax: 2,
  walkJogRestDays: 2,
  rideAfterWalkJogMin: 15,
  rideAfterWalkJogMax: 20,
};

const TEXT_KEYS = new Set<keyof ProgramSettings>(["orthoName", "orthoPhone"]);

/** "barbellStepLb" -> "barbell_step_lb", the row key. */
export function settingRowKey(field: keyof ProgramSettings) {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Defaults overlaid with whatever rows exist; blank numbers keep the default. */
export function programSettingsFromRows(
  rows: Pick<TrainingSetting, "key" | "value" | "textValue">[],
): ProgramSettings {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const result = { ...DEFAULT_PROGRAM_SETTINGS } as Record<
    keyof ProgramSettings,
    number | string | null
  >;
  for (const field of Object.keys(
    DEFAULT_PROGRAM_SETTINGS,
  ) as (keyof ProgramSettings)[]) {
    const row = byKey.get(settingRowKey(field));
    if (!row) continue;
    if (TEXT_KEYS.has(field)) {
      const text = row.textValue?.trim() ?? "";
      result[field] =
        text === ""
          ? field === "orthoPhone"
            ? null
            : DEFAULT_PROGRAM_SETTINGS.orthoName
          : text;
    } else if (row.value != null && Number.isFinite(row.value)) {
      result[field] = row.value;
    }
  }
  return result as ProgramSettings;
}
