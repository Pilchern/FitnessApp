import type { SupplementLog, TrainingTemplate } from "@fitness-app/domain";
import type { ProgramService } from "../program/program-service";
import { loadProgramWeekTargets } from "../program/program-week";
import type { TrainingTemplateService } from "../training/training-template";

export type PlanAdherence = {
  liftsScheduled: number;
  cardioScheduled: number;
  /** The week's planned Zone 2 minutes; null when nothing sets one. */
  zone2TargetMinutes: number | null;
  /** Share of habit-days ticked across active habits, 0-100; null with no habits. */
  habitCompletionPct: number | null;
};

/** What the week's plan scheduled. */
export type WeekSchedule = Pick<
  PlanAdherence,
  "liftsScheduled" | "cardioScheduled" | "zone2TargetMinutes"
>;

function targetZone2(definition: unknown): number {
  if (typeof definition !== "object" || definition === null) return 0;
  const value = (definition as { targetZone2Minutes?: unknown })
    .targetZone2Minutes;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Fallback only, for a week no active program covers: the active templates
 * with a scheduled weekday (each counts once per week).
 */
export function templateWeekSchedule(
  templates: Pick<
    TrainingTemplate,
    "templateType" | "scheduledDayOfWeek" | "definition"
  >[],
): WeekSchedule {
  const scheduled = templates.filter((t) => t.scheduledDayOfWeek != null);
  const cardio = scheduled.filter((t) => t.templateType === "cardio");
  const zone2 = cardio.reduce((sum, t) => sum + targetZone2(t.definition), 0);
  return {
    liftsScheduled: scheduled.filter((t) => t.templateType === "strength")
      .length,
    cardioScheduled: cardio.length,
    zone2TargetMinutes: zone2 > 0 ? zone2 : null,
  };
}

/**
 * The week's schedule from the active program (the plan since 2026-10-19),
 * counted exactly as the dashboard plan card counts it. Falls back to the
 * templates only when there is no active program or no program block covers
 * the week. A program load error propagates; it never silently turns into
 * the template numbers.
 */
export async function loadWeekSchedule(
  deps: {
    programService?: Pick<
      ProgramService,
      "getActiveProgram" | "listSettings" | "listKneeChecks"
    >;
    trainingTemplateService: Pick<
      TrainingTemplateService,
      "listActiveStrengthTemplates" | "listActiveCardioTemplates"
    >;
  },
  query: { userId: string; startDate: string; endDate: string },
): Promise<WeekSchedule> {
  const program = deps.programService
    ? await loadProgramWeekTargets(deps.programService, query)
    : null;
  if (program) {
    return {
      ...program,
      zone2TargetMinutes:
        program.zone2TargetMinutes > 0 ? program.zone2TargetMinutes : null,
    };
  }
  // No active program covers this week: the templates are the plan.
  const [strength, cardio] = await Promise.all([
    deps.trainingTemplateService.listActiveStrengthTemplates({
      userId: query.userId,
    }),
    deps.trainingTemplateService.listActiveCardioTemplates({
      userId: query.userId,
    }),
  ]);
  return templateWeekSchedule([...strength, ...cardio]);
}

/**
 * What the week's plan asked for (see `loadWeekSchedule`), plus habit
 * completion over the week. The weekly score, AI draft and insights measure
 * against these instead of fixed targets.
 */
export function buildPlanAdherence(input: {
  schedule: WeekSchedule;
  habitIds: string[];
  habitLogs: Pick<SupplementLog, "supplementId" | "taken" | "logDate">[];
  days?: number;
}): PlanAdherence {
  const habitIds = new Set(input.habitIds);
  const ticked = new Set(
    input.habitLogs
      .filter((log) => log.taken && habitIds.has(log.supplementId))
      .map((log) => `${log.supplementId}:${log.logDate}`),
  );
  const possible = habitIds.size * (input.days ?? 7);

  return {
    liftsScheduled: input.schedule.liftsScheduled,
    cardioScheduled: input.schedule.cardioScheduled,
    zone2TargetMinutes: input.schedule.zone2TargetMinutes,
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
