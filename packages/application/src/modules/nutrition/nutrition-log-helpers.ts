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
  const mealsOnPlanDays = logs.filter(
    (log) => log.mealsOnPlan === true,
  ).length;
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
