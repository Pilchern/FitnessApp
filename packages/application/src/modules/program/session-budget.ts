import type {
  ExerciseMeasure,
  ProgramExerciseCategory,
  ProgramSessionType,
  SideMode,
} from "@fitness-app/domain";
import { isPlannedToday, type PlannedSession } from "./program-plan";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
} from "./program-settings";

type BudgetSettings = Pick<
  ProgramSettings,
  | "sessionWarmUpMinutes"
  | "sessionGaitDrillMinutes"
  | "sessionTransitionMinutes"
  | "setWorkSeconds"
  | "plyoWorkSeconds"
  | "restMainSeconds"
  | "restPairSeconds"
  | "restAccessorySeconds"
  | "restPlyoSeconds"
  | "liftSessionMaxMinutes"
>;

/** What the time budget and the rest timer need to know about one item. */
export type BudgetItem = {
  name: string;
  sets: number;
  /** Per-leg work: extra left-only sets (one side each). */
  leftExtraSets?: number;
  measure: ExerciseMeasure;
  sideMode: SideMode;
  category: ProgramExerciseCategory | null;
  secondsTarget: number | null;
  /** Superset letter; null = straight sets. */
  supersetGroup: string | null;
  supersetOrder: number | null;
};

/** "A1", "A2"; null outside a superset. */
export function supersetLabel(
  item: Pick<BudgetItem, "supersetGroup" | "supersetOrder">,
) {
  if (!item.supersetGroup) return null;
  return `${item.supersetGroup}${item.supersetOrder ?? ""}`;
}

/** Rest after a straight set: main 150 s, plyo 60 s, everything else 60 s. */
export function restSecondsFor(
  category: ProgramExerciseCategory | null,
  settings: BudgetSettings = DEFAULT_PROGRAM_SETTINGS,
) {
  if (category === "main") return settings.restMainSeconds;
  if (category === "plyo") return settings.restPlyoSeconds;
  return settings.restAccessorySeconds;
}

function sides(item: Pick<BudgetItem, "sideMode">) {
  return item.sideMode === "bilateral" ? 1 : 2;
}

/**
 * One side of one set: the hold time for timed and isometric work, about
 * 15 s for a plyo set (a few contacts), else 40 s.
 */
function workSeconds(item: BudgetItem, settings: BudgetSettings) {
  if (
    (item.measure === "time" || item.measure === "force") &&
    item.secondsTarget != null &&
    item.secondsTarget > 0
  ) {
    return item.secondsTarget;
  }
  if (item.category === "plyo") return settings.plyoWorkSeconds;
  return settings.setWorkSeconds;
}

/**
 * Items in session order, grouped: a superset is the run of items sharing a
 * letter (only those planned today), anything else stands alone. A
 * "superset" with one item left (its partner gated off) is a straight set.
 */
export function groupItems<T extends BudgetItem>(items: T[]): T[][] {
  const groups: T[][] = [];
  const byLetter = new Map<string, T[]>();
  for (const item of items) {
    if (item.supersetGroup) {
      const existing = byLetter.get(item.supersetGroup);
      if (existing) {
        existing.push(item);
        continue;
      }
      const group = [item];
      byLetter.set(item.supersetGroup, group);
      groups.push(group);
    } else {
      groups.push([item]);
    }
  }
  return groups.map((g) =>
    [...g].sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0)),
  );
}

/** Seconds of work and rest for a list of items (no warm-up or transitions). */
export function workingSeconds(
  items: BudgetItem[],
  settings: BudgetSettings = DEFAULT_PROGRAM_SETTINGS,
) {
  let total = 0;
  for (const group of groupItems(items.filter((i) => i.sets > 0))) {
    if (group.length === 1) {
      const item = group[0] as BudgetItem;
      total +=
        item.sets *
          (sides(item) * workSeconds(item, settings) +
            restSecondsFor(item.category, settings)) +
        (item.leftExtraSets ?? 0) *
          (workSeconds(item, settings) +
            restSecondsFor(item.category, settings));
      continue;
    }
    const rounds = Math.max(...group.map((i) => i.sets));
    for (let round = 1; round <= rounds; round += 1) {
      for (const item of group) {
        if (item.sets >= round) {
          total += sides(item) * workSeconds(item, settings);
        }
      }
      total += settings.restPairSeconds;
    }
    // Extra left sets inside a superset: one side, then the pair rest.
    for (const item of group) {
      total +=
        (item.leftExtraSets ?? 0) *
        (workSeconds(item, settings) + settings.restPairSeconds);
    }
  }
  return total;
}

export type SessionEstimate = {
  minutes: number;
  /** Lift sessions over the limit (60 min). */
  overBudget: boolean;
};

/**
 * Estimated minutes: sets x (work + rest), plus warm-up 5, gait drill 3 and
 * transitions 4 on lift days. Rides and walks use their planned length.
 */
export function estimateSessionMinutes(
  input: {
    sessionType: ProgramSessionType;
    items: BudgetItem[];
    minutesMax?: number | null;
    /** Extra fixed minutes (the knee-off ROM + walk block). */
    extraMinutes?: number;
  },
  settings: BudgetSettings = DEFAULT_PROGRAM_SETTINGS,
): SessionEstimate | null {
  const extra = input.extraMinutes ?? 0;
  if (input.sessionType === "lift") {
    const minutes =
      Math.ceil(workingSeconds(input.items, settings) / 60) +
      extra +
      settings.sessionWarmUpMinutes +
      settings.sessionGaitDrillMinutes +
      settings.sessionTransitionMinutes;
    return { minutes, overBudget: minutes > settings.liftSessionMaxMinutes };
  }
  if (input.items.length > 0) {
    const minutes =
      Math.ceil(workingSeconds(input.items, settings) / 60) + extra;
    return { minutes, overBudget: false };
  }
  if (input.minutesMax != null) {
    return { minutes: input.minutesMax, overBudget: false };
  }
  return null;
}

export type RestCall = {
  /** 0 = go straight to the next item or side. */
  seconds: number;
  /** "Right leg", "Next: A2 Pull-Up", "Back to A1 Squat". */
  next: string | null;
};

/**
 * Rest after ticking one set:
 * - per-leg or per-side, first side: no rest, do the other side;
 * - in a superset, before the last item: no rest, go to the next item;
 * - last item of a superset: the pair rest (90 s), then back to the first;
 * - a straight set: its category's rest (main 150 s, else 60 s).
 * `group` is the item's superset as planned today (itself alone outside one).
 */
export function restAfterSet(
  input: {
    item: BudgetItem;
    side: "left" | "right" | null;
    group: BudgetItem[];
  },
  settings: BudgetSettings = DEFAULT_PROGRAM_SETTINGS,
): RestCall {
  const { item, side } = input;
  if (item.sideMode !== "bilateral" && side === "left") {
    return {
      seconds: 0,
      next: item.sideMode === "per_leg" ? "Right leg" : "Right side",
    };
  }
  const group = [...input.group].sort(
    (a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0),
  );
  if (group.length > 1) {
    const index = group.findIndex((g) => g.name === item.name);
    const nextItem = group[index + 1];
    if (index >= 0 && nextItem) {
      return {
        seconds: 0,
        next: `Next: ${[supersetLabel(nextItem), nextItem.name].filter(Boolean).join(" ")}`,
      };
    }
    const first = group[0] as BudgetItem;
    return {
      seconds: settings.restPairSeconds,
      next: `Then ${[supersetLabel(first), first.name].filter(Boolean).join(" ")}`,
    };
  }
  return { seconds: restSecondsFor(item.category, settings), next: null };
}

/** Budget items for what actually runs today (gated-off and knee-off work left out). */
export function plannedBudgetItems(planned: PlannedSession): BudgetItem[] {
  return planned.exercises
    .filter(isPlannedToday)
    .filter((p) => !(planned.legBlockReplaced && p.part === "legs"))
    .map((p) => ({
      name: p.name,
      sets: p.sets,
      leftExtraSets: p.leftExtraSets ?? 0,
      measure: p.exercise.measure,
      sideMode: p.exercise.sideMode,
      category: p.exercise.category,
      secondsTarget: p.exercise.secondsTarget,
      supersetGroup: p.exercise.supersetGroup ?? null,
      supersetOrder: p.exercise.supersetOrder ?? null,
    }));
}

/** Estimate for one planned session, as it will run today. */
export function estimatePlannedSession(
  planned: PlannedSession,
  settings: BudgetSettings &
    Pick<ProgramSettings, "kneeOffBlockMinutes"> = DEFAULT_PROGRAM_SETTINGS,
): SessionEstimate | null {
  return estimateSessionMinutes(
    {
      sessionType: planned.session.sessionType,
      items: plannedBudgetItems(planned),
      minutesMax: planned.ride?.minutesMax ?? planned.session.minutesMax,
      extraMinutes: planned.legBlockReplaced ? settings.kneeOffBlockMinutes : 0,
    },
    settings,
  );
}
