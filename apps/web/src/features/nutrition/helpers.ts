import type { NutritionLog } from "@fitness-app/domain";
import type { NutritionFormValues } from "./types";

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toNutritionFormValues(
  log: NutritionLog | null,
): NutritionFormValues {
  if (!log) {
    return {
      logDate: todayIsoDate(),
      proteinHit: false,
      mealsOnPlan: false,
      noPostDinnerSnacking: false,
      junkLeakage: false,
      fiberTaken: false,
      alcoholCount: "0",
      proteinGrams: "",
      calories: "",
      netCarbsGrams: "",
      fatGrams: "",
      fiberGrams: "",
      creatineTaken: false,
      protein50By9am: false,
      notes: "",
    };
  }

  return {
    id: log.id,
    logDate: log.logDate,
    proteinHit: log.proteinHit ?? false,
    mealsOnPlan: log.mealsOnPlan ?? false,
    noPostDinnerSnacking: log.noPostDinnerSnacking ?? false,
    junkLeakage: log.junkLeakage ?? false,
    fiberTaken: log.fiberTaken ?? false,
    alcoholCount: `${log.alcoholCount}`,
    proteinGrams: log.proteinGrams != null ? `${log.proteinGrams}` : "",
    calories: log.calories != null ? `${log.calories}` : "",
    netCarbsGrams: log.netCarbsGrams != null ? `${log.netCarbsGrams}` : "",
    fatGrams: log.fatGrams != null ? `${log.fatGrams}` : "",
    fiberGrams: log.fiberGrams != null ? `${log.fiberGrams}` : "",
    creatineTaken: log.creatineTaken ?? false,
    protein50By9am: log.protein50By9am ?? false,
    notes: log.notes ?? "",
  };
}

export function formatNutritionDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function countAdherenceChecks(log: NutritionLog): number {
  let count = 0;
  if (log.proteinHit === true) count++;
  if (log.mealsOnPlan === true) count++;
  if (log.noPostDinnerSnacking === true) count++;
  if (log.junkLeakage === false) count++;
  if (log.fiberTaken === true) count++;
  return count;
}

export function totalPossibleChecks(log: NutritionLog): number {
  let total = 0;
  if (log.proteinHit !== null) total++;
  if (log.mealsOnPlan !== null) total++;
  if (log.noPostDinnerSnacking !== null) total++;
  if (log.junkLeakage !== null) total++;
  if (log.fiberTaken !== null) total++;
  return total;
}
