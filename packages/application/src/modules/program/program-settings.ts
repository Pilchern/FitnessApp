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
  // Phase B
  liftsPerWeek: number;
  ridesPerWeek: number;
  romDaysPerWeek: number;
  ptVisitsPerWeek: number;
  executionBannerWeeks: number;
  /** "HH:MM" local time. */
  calendarLiftTime: string;
  calendarLiftMinutes: number;
  calendarPelotonTime: string;
  calendarPelotonMinutes: number;
  calendarTestTime: string;
  calendarTestMinutes: number;
  caloriesLiftDayMin: number;
  caloriesLiftDayMax: number;
  caloriesRestDay: number;
  proteinFlagBelowG: number;
  sleepFlagBelowH: number;
  weightRiseLbPerWeek: number;
  weightRiseWeeks: number;
  waistEveryDays: number;
  lsiTarget1: number;
  lsiTarget2: number;
  lsiTarget3: number;
  walkingAsymmetryTargetPct: number;
  // Program v1
  holdStepSeconds: number;
  pullUpLoadAtTotalReps: number;
  /** Lift-day warm-up, items separated by "; ". */
  warmUp: string;
  /** The program's global rules, one per line. */
  programRules: string;
};

export const DEFAULT_WARM_UP =
  "Peloton easy 5 min; band TKE 15/leg; box squat bodyweight x10; glute bridge x10; leg swings 10/side";

export const DEFAULT_PROGRAM_RULES = [
  "Order: readiness check, warm-up, power/plyo, main leg lift, leg accessories, upper body, core/finisher.",
  "Main lifts never to failure. Accessories may go to RIR 1.",
  "Double progression: every set at the top of the range at the target RIR or better, then +5 lb barbell / next DB / +2.5 lb cuff / +5 s holds. Otherwise repeat.",
  "Per-leg lifts: left first; its reps set the target; the right matches at the same load. Progress off the left only.",
  "No load increase unless the knee check is normal, outside deloads, and 3-night sleep is 6.5 h or more.",
  "Deload: one set off everything, no load increases, plyo volume halved.",
  "Hard quad sets: 12-16 a week.",
  "Zone 2: 150 min a week (rides and walks at Zone 2 heart rate). 8,000 steps and the 5-min ROM check daily.",
  "Pull-ups: at 30 total reps across sets, add load (belt or DB between the feet).",
  "No conventional deadlifts. No kneeling on the left knee (half-kneel on the right only).",
  "Pull-ups: step down onto the bench with the right leg, never drop off the bar, until the plyo gate is cleared.",
].join("\n");

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
  liftsPerWeek: 3,
  ridesPerWeek: 3,
  romDaysPerWeek: 7,
  ptVisitsPerWeek: 2,
  executionBannerWeeks: 2,
  calendarLiftTime: "18:00",
  calendarLiftMinutes: 80,
  calendarPelotonTime: "18:00",
  calendarPelotonMinutes: 45,
  calendarTestTime: "09:00",
  calendarTestMinutes: 30,
  caloriesLiftDayMin: 2400,
  caloriesLiftDayMax: 2500,
  caloriesRestDay: 2200,
  proteinFlagBelowG: 160,
  sleepFlagBelowH: 7,
  weightRiseLbPerWeek: 0.5,
  weightRiseWeeks: 2,
  waistEveryDays: 30,
  lsiTarget1: 70,
  lsiTarget2: 80,
  lsiTarget3: 90,
  walkingAsymmetryTargetPct: 5,
  holdStepSeconds: 5,
  pullUpLoadAtTotalReps: 30,
  warmUp: DEFAULT_WARM_UP,
  programRules: DEFAULT_PROGRAM_RULES,
};

const TEXT_KEYS = new Set<keyof ProgramSettings>([
  "orthoName",
  "orthoPhone",
  "calendarLiftTime",
  "calendarPelotonTime",
  "calendarTestTime",
  "warmUp",
  "programRules",
]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
      const fallback = DEFAULT_PROGRAM_SETTINGS[field];
      if (field.startsWith("calendar")) {
        result[field] = TIME_PATTERN.test(text) ? text : fallback;
      } else {
        result[field] = text === "" ? fallback : text;
      }
    } else if (row.value != null && Number.isFinite(row.value)) {
      result[field] = row.value;
    }
  }
  return result as ProgramSettings;
}
