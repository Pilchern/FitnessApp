import type { RoutineStep } from "@/lib/routines";

export type RoutinePosition =
  | {
      done: false;
      index: number;
      phase: "prep" | "hold";
      /** Seconds left in the current phase, rounded up for display. */
      remaining: number;
    }
  | { done: true };

/** Seconds from the start of the routine to the start of each step. */
export function stepStartOffsets(
  steps: Pick<RoutineStep, "seconds">[],
  prepSeconds: number,
): number[] {
  const offsets: number[] = [];
  let at = 0;
  for (const step of steps) {
    offsets.push(at);
    at += prepSeconds + step.seconds;
  }
  return offsets;
}

export function routineTotalSeconds(
  steps: Pick<RoutineStep, "seconds">[],
  prepSeconds: number,
): number {
  return steps.reduce((sum, s) => sum + prepSeconds + s.seconds, 0);
}

/**
 * Where the routine is after `elapsedSeconds` of running time. Derived from
 * elapsed time rather than ticked forward, so a locked phone or a throttled
 * tab picks up at the right step instead of drifting.
 */
export function positionAt(
  steps: Pick<RoutineStep, "seconds">[],
  prepSeconds: number,
  elapsedSeconds: number,
): RoutinePosition {
  let at = 0;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    if (elapsedSeconds < at + prepSeconds) {
      return {
        done: false,
        index,
        phase: "prep",
        remaining: Math.ceil(at + prepSeconds - elapsedSeconds),
      };
    }
    at += prepSeconds;
    if (elapsedSeconds < at + step.seconds) {
      return {
        done: false,
        index,
        phase: "hold",
        remaining: Math.ceil(at + step.seconds - elapsedSeconds),
      };
    }
    at += step.seconds;
  }
  return { done: true };
}

export function formatMinutes(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} min`;
}

export function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}`;
}
