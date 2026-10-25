import type { NutritionLog } from "@fitness-app/domain";

export type NutritionAdherenceSummary = {
  totalDays: number;
  proteinHitDays: number;
  mealsOnPlanDays: number;
  noPostDinnerSnackingDays: number;
  noJunkLeakageDays: number;
  fiberTakenDays: number;
  totalAlcohol: number;
  adherencePct: number;
};

export function buildNutritionAdherenceSummary(
  logs: NutritionLog[],
): NutritionAdherenceSummary {
  const totalDays = logs.length;

  const proteinHitDays = logs.filter((log) => log.proteinHit === true).length;
  const mealsOnPlanDays = logs.filter((log) => log.mealsOnPlan === true).length;
  const noPostDinnerSnackingDays = logs.filter(
    (log) => log.noPostDinnerSnacking === true,
  ).length;
  const noJunkLeakageDays = logs.filter(
    (log) => log.junkLeakage === false,
  ).length;
  const fiberTakenDays = logs.filter((log) => log.fiberTaken === true).length;

  const totalAlcohol = logs.reduce((sum, log) => sum + log.alcoholCount, 0);

  // For each boolean field, compute the proportion of days that "hit" among
  // days that actually have data. Then average those proportions.
  const checkFields: Array<{
    hit: number;
    total: number;
  }> = [
    {
      hit: proteinHitDays,
      total: logs.filter((log) => log.proteinHit !== null).length,
    },
    {
      hit: mealsOnPlanDays,
      total: logs.filter((log) => log.mealsOnPlan !== null).length,
    },
    {
      hit: noPostDinnerSnackingDays,
      total: logs.filter((log) => log.noPostDinnerSnacking !== null).length,
    },
    {
      hit: noJunkLeakageDays,
      total: logs.filter((log) => log.junkLeakage !== null).length,
    },
    {
      hit: fiberTakenDays,
      total: logs.filter((log) => log.fiberTaken !== null).length,
    },
  ];

  const fieldsWithData = checkFields.filter((field) => field.total > 0);

  const adherencePct =
    fieldsWithData.length === 0
      ? 0
      : Math.round(
          (fieldsWithData.reduce(
            (sum, field) => sum + field.hit / field.total,
            0,
          ) /
            fieldsWithData.length) *
            100,
        );

  return {
    totalDays,
    proteinHitDays,
    mealsOnPlanDays,
    noPostDinnerSnackingDays,
    noJunkLeakageDays,
    fiberTakenDays,
    totalAlcohol,
    adherencePct,
  };
}

export type MacroKey =
  | "calories"
  | "proteinGrams"
  | "netCarbsGrams"
  | "fatGrams"
  | "fiberGrams";

export type MacroAverage = {
  key: MacroKey;
  label: string;
  unit: string;
  /** Mean over the days in the window that have this value. */
  avg: number | null;
  daysWithValue: number;
  target: number | null;
};

export type MacroWeek = {
  start: string;
  end: string;
  /** Days in the window with calories logged (the "logged in Cronometer" count). */
  daysLogged: number;
  macros: MacroAverage[];
};

const MACROS: { key: MacroKey; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinGrams", label: "Protein", unit: "g" },
  { key: "netCarbsGrams", label: "Net carbs", unit: "g" },
  { key: "fatGrams", label: "Fat", unit: "g" },
  { key: "fiberGrams", label: "Fiber", unit: "g" },
];

function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * 7-day averages of each macro for the window ending `end` (inclusive),
 * against the daily targets. A day missing a value is left out of that
 * macro's average, not counted as zero.
 */
export function macroWeek(
  logs: Pick<NutritionLog, "logDate" | MacroKey>[],
  end: string,
  targets: Partial<Record<MacroKey, number | null>>,
  days = 7,
): MacroWeek {
  const start = shiftDate(end, -(days - 1));
  const inWindow = logs.filter((l) => l.logDate >= start && l.logDate <= end);
  return {
    start,
    end,
    daysLogged: new Set(
      inWindow.filter((l) => l.calories != null).map((l) => l.logDate),
    ).size,
    macros: MACROS.map((m) => {
      const values = inWindow
        .map((l) => l[m.key])
        .filter((v): v is number => v != null);
      return {
        ...m,
        avg:
          values.length > 0
            ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
            : null,
        daysWithValue: values.length,
        target: targets[m.key] ?? null,
      };
    }),
  };
}
