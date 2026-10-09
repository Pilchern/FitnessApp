import type { SupplementLog, TrainingTemplate } from "@fitness-app/domain";

export type PlanAdherence = {
  liftsScheduled: number;
  cardioScheduled: number;
  /** Sum of the scheduled cardio templates' targetZone2Minutes; null if none set one. */
  zone2TargetMinutes: number | null;
  /** Share of habit-days ticked across active habits, 0-100; null with no habits. */
  habitCompletionPct: number | null;
};

function targetZone2(definition: unknown): number {
  if (typeof definition !== "object" || definition === null) return 0;
  const value = (definition as { targetZone2Minutes?: unknown })
    .targetZone2Minutes;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * What the week's plan asked for, from the active templates with a scheduled
 * weekday (each counts once per week), plus habit completion over the week.
 * The weekly score and AI draft measure against these instead of fixed
 * targets, so changing a template (e.g. the bike ramp after PT) moves the
 * review with it. The dashboard Plan card reads the same templates.
 */
export function buildPlanAdherence(input: {
  templates: Pick<
    TrainingTemplate,
    "templateType" | "scheduledDayOfWeek" | "definition"
  >[];
  habitIds: string[];
  habitLogs: Pick<SupplementLog, "supplementId" | "taken" | "logDate">[];
  days?: number;
}): PlanAdherence {
  const scheduled = input.templates.filter((t) => t.scheduledDayOfWeek != null);
  const cardio = scheduled.filter((t) => t.templateType === "cardio");
  const zone2 = cardio.reduce((sum, t) => sum + targetZone2(t.definition), 0);
  const habitIds = new Set(input.habitIds);
  const ticked = new Set(
    input.habitLogs
      .filter((log) => log.taken && habitIds.has(log.supplementId))
      .map((log) => `${log.supplementId}:${log.logDate}`),
  );
  const possible = habitIds.size * (input.days ?? 7);

  return {
    liftsScheduled: scheduled.filter((t) => t.templateType === "strength")
      .length,
    cardioScheduled: cardio.length,
    zone2TargetMinutes: zone2 > 0 ? zone2 : null,
    habitCompletionPct:
      possible > 0 ? Math.round((ticked.size / possible) * 100) : null,
  };
}

/** The plan-adherence fields of a stored summary, for carrying through an edit. */
export function pickPlanAdherence(summary: {
  liftsScheduled?: number | null;
  cardioScheduled?: number | null;
  zone2TargetMinutes?: number | null;
  habitCompletionPct?: number | null;
}): Partial<PlanAdherence> {
  return {
    liftsScheduled: summary.liftsScheduled ?? undefined,
    cardioScheduled: summary.cardioScheduled ?? undefined,
    zone2TargetMinutes: summary.zone2TargetMinutes ?? undefined,
    habitCompletionPct: summary.habitCompletionPct ?? undefined,
  };
}
