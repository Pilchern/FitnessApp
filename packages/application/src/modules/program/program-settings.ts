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
  /** Heaviest dumbbell owned: suggested DB loads stop here. */
  dumbbellMaxLb: number;
  cuffStepLb: number;
  progressionMinRir: number;
  sleepMinHoursForIncrease: number;
  sleepAverageNights: number;
  /** Hold loads when the left quad crane test drops more than this week over week. */
  quadDropHoldN: number;
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
  /** Daily macro targets beside the profile's kcal, protein and fiber. */
  netCarbsTargetG: number;
  fatTargetG: number;
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
  // Program v2: session time budget and rest
  sessionWarmUpMinutes: number;
  sessionGaitDrillMinutes: number;
  sessionTransitionMinutes: number;
  setWorkSeconds: number;
  /** A plyo or sprint set is a few seconds of contacts, not a 40 s set. */
  plyoWorkSeconds: number;
  restMainSeconds: number;
  restPairSeconds: number;
  restAccessorySeconds: number;
  restPlyoSeconds: number;
  liftSessionMaxMinutes: number;
  /** New block: last block's top load x this, once per step down in reps. */
  newBlockLoadMultiplier: number;
  /** 1 = add lateral raise 3 x 15-20 to Wednesday's A pair (program seed). */
  shoulderEmphasis: number;
  /** Lift-day gait drill, after the warm-up. */
  gaitDrill: string;
  // Body composition targets (DEXA, 2026-10-24 baseline). The quad strength
  // LSI return-to-sport gate is lsiTarget3.
  almiTargetJan27: number;
  almiTargetOct27: number;
  almiTarget2029: number;
  legLeanLsiTargetJan27: number;
  legLeanLsiTargetOct27: number;
  dexaBfTargetJan27: number;
  dexaBfTargetOct27: number;
  dexaBfTarget2029: number;
  /** Waist at the navel, at or under. */
  waistTargetIn: number;
  /** DEXA visceral fat, hold under. */
  vatMaxLb: number;
  /** Planned DEXA scans, "YYYY-MM-DD, YYYY-MM-DD". */
  dexaNextDates: string;
};

export const DEFAULT_GAIT_DRILL =
  "Slow march, then step-throughs to a metronome at preferred cadence +5%.";

export const DEFAULT_WARM_UP =
  "Peloton easy 3 min; band TKE 15/leg; bodyweight box squat x10; glute bridge x10";

export const DEFAULT_PROGRAM_RULES = [
  "Order: readiness check, warm-up, gait drill, plyos/power, main pairs, accessories.",
  "Supersets: alternate A1 and A2, rest after the pair. Per-leg work: left then right, no rest between.",
  "Lift days: about an hour (43-63 min), at most 4 upper-body movements.",
  "Main lifts never to failure. Accessories may go to RIR 1.",
  "Double progression: every set at the top of the range at the target RIR or better, then +5 lb barbell / next DB / +2.5 lb cuff / +5 s holds. Otherwise repeat.",
  "Per-leg lifts: left first; its reps set the target; the right matches at the same load. Progress off the left only.",
  "No load increase unless the knee check is normal, outside deloads, and 3-night sleep is 6.5 h or more.",
  "Deload: one set off everything, no load increases, plyo volume halved.",
  "New block: last block's top working load x 1.1 per step down in reps (suggested, editable).",
  "Hard quad sets: 12-16 a week.",
  "Zone 2: 150 min a week. 8,000 steps and the 5-min ROM check (prone hang, heel slides) daily.",
  "Pull-ups: at 30 total reps across sets, add load (belt or DB between the feet).",
  "No conventional deadlifts. No kneeling on the left knee (half-kneel on the right only).",
  "Pull-ups: step down onto the bench with the right leg, never drop off the bar, until the plyo_single gate is on.",
].join("\n");

export const DEFAULT_PROGRAM_SETTINGS: ProgramSettings = {
  barbellStepLb: 5,
  dumbbellFineStepLb: 2.5,
  dumbbellFineLimitLb: 25,
  dumbbellCoarseStepLb: 5,
  dumbbellMaxLb: 52.5,
  cuffStepLb: 2.5,
  progressionMinRir: 2,
  sleepMinHoursForIncrease: 6.5,
  sleepAverageNights: 3,
  quadDropHoldN: 65,
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
  calendarLiftMinutes: 60,
  calendarPelotonTime: "18:00",
  calendarPelotonMinutes: 45,
  calendarTestTime: "09:00",
  calendarTestMinutes: 30,
  caloriesLiftDayMin: 2400,
  caloriesLiftDayMax: 2500,
  caloriesRestDay: 2450,
  netCarbsTargetG: 255,
  fatTargetG: 70,
  proteinFlagBelowG: 160,
  sleepFlagBelowH: 7,
  weightRiseLbPerWeek: 0.5,
  weightRiseWeeks: 2,
  waistEveryDays: 30,
  lsiTarget1: 70,
  lsiTarget2: 80,
  lsiTarget3: 90,
  walkingAsymmetryTargetPct: 8,
  holdStepSeconds: 5,
  pullUpLoadAtTotalReps: 30,
  warmUp: DEFAULT_WARM_UP,
  programRules: DEFAULT_PROGRAM_RULES,
  sessionWarmUpMinutes: 5,
  sessionGaitDrillMinutes: 3,
  sessionTransitionMinutes: 4,
  setWorkSeconds: 40,
  plyoWorkSeconds: 15,
  restMainSeconds: 150,
  restPairSeconds: 90,
  restAccessorySeconds: 60,
  restPlyoSeconds: 60,
  liftSessionMaxMinutes: 60,
  newBlockLoadMultiplier: 1.1,
  shoulderEmphasis: 0,
  gaitDrill: DEFAULT_GAIT_DRILL,
  almiTargetJan27: 8.25,
  almiTargetOct27: 8.7,
  almiTarget2029: 9.5,
  legLeanLsiTargetJan27: 94,
  legLeanLsiTargetOct27: 97,
  dexaBfTargetJan27: 21.5,
  dexaBfTargetOct27: 17.5,
  dexaBfTarget2029: 15,
  waistTargetIn: 34.5,
  vatMaxLb: 0.25,
  dexaNextDates: "2027-01-16, 2027-04-16",
};

/**
 * Gates switched from Settings rather than cleared by PT: on while the
 * setting is 1 or more. They are hidden from the gates list.
 */
export const SETTING_GATES: Partial<Record<string, keyof ProgramSettings>> = {
  shoulder_emphasis: "shoulderEmphasis",
};

export function isSettingGate(gateKey: string) {
  return gateKey in SETTING_GATES;
}

/** The gates with each settings-driven gate on or off per its setting. */
export function applySettingGates<
  G extends { gateKey: string; clearedOn: string | null },
>(gates: G[], settings: ProgramSettings): G[] {
  return gates.map((g) => {
    const field = SETTING_GATES[g.gateKey];
    if (!field) return g;
    const on = Number(settings[field]) >= 1;
    return { ...g, clearedOn: on ? "2000-01-01" : null };
  });
}

const TEXT_KEYS = new Set<keyof ProgramSettings>([
  "orthoName",
  "orthoPhone",
  "calendarLiftTime",
  "calendarPelotonTime",
  "calendarTestTime",
  "warmUp",
  "programRules",
  "gaitDrill",
  "dexaNextDates",
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
