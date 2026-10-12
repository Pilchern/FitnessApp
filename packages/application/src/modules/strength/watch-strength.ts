import type { StrengthSession, UserId } from "@fitness-app/domain";
import { z } from "zod";
import { isoDateSchema } from "../../shared/primitives";
import type { StrengthSessionDateRangeQuery } from "./strength-session";

/**
 * An Apple Watch strength workout (Health Auto Export). It carries the
 * session's timing, heart rate and energy, not its sets; those come from the
 * lift logger. The two meet on the session for that local date.
 */
export const watchStrengthWorkoutSchema = z.object({
  externalId: z.string().trim().min(1),
  workoutType: z.string().trim().min(1),
  /** The workout's local calendar date, as the Watch recorded it. */
  localDate: isoDateSchema,
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }).nullable(),
  durationMinutes: z.number().int().min(1).max(600).nullable(),
  avgHeartRate: z.number().int().min(20).max(250).nullable(),
  maxHeartRate: z.number().int().min(20).max(250).nullable(),
  activeEnergyKcal: z.number().int().min(0).max(5000).nullable(),
});

export type WatchStrengthWorkout = z.infer<typeof watchStrengthWorkoutSchema>;

export type WatchStrengthPatch = Partial<{
  startedAt: string;
  /** Sent with startedAt; null clears an end that would precede the start. */
  endedAt: string | null;
  durationMinutes: number;
  avgHeartRate: number;
  maxHeartRate: number;
  activeEnergyKcal: number;
}>;

export type WatchStrengthPlan =
  | { kind: "patch"; sessionId: string; patch: WatchStrengthPatch }
  | { kind: "create" }
  | { kind: "none" };

/**
 * One Watch summary per local date. Two strength workouts on a day (a warm-up
 * logged as Functional, then the lift) are one session in the app: durations
 * and energy add, heart rate averages by duration, the span runs from the
 * first start to the last end.
 */
export function combineWatchWorkoutsByDate(
  workouts: WatchStrengthWorkout[],
): WatchStrengthWorkout[] {
  const byDate = new Map<string, WatchStrengthWorkout[]>();
  for (const workout of workouts) {
    byDate.set(workout.localDate, [
      ...(byDate.get(workout.localDate) ?? []),
      workout,
    ]);
  }
  return [...byDate.values()].map((group) => {
    const sorted = [...group].sort(
      (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
    );
    if (sorted.length === 1) return sorted[0]!;
    const sumOrNull = (values: (number | null)[]) =>
      values.every((v) => v == null)
        ? null
        : values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const weighted = sorted.filter(
      (w) => w.avgHeartRate != null && w.durationMinutes != null,
    );
    const weight = weighted.reduce((sum, w) => sum + w.durationMinutes!, 0);
    const maxes = sorted
      .map((w) => w.maxHeartRate)
      .filter((v): v is number => v != null);
    const ends = sorted
      .map((w) => w.endedAt)
      .filter((v): v is string => v != null)
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    const duration = sumOrNull(sorted.map((w) => w.durationMinutes));
    return {
      ...sorted[0]!,
      endedAt: ends.at(-1) ?? null,
      durationMinutes: duration != null ? Math.min(600, duration) : null,
      avgHeartRate:
        weight > 0
          ? Math.round(
              weighted.reduce(
                (sum, w) => sum + w.avgHeartRate! * w.durationMinutes!,
                0,
              ) / weight,
            )
          : (sorted.find((w) => w.avgHeartRate != null)?.avgHeartRate ?? null),
      maxHeartRate: maxes.length > 0 ? Math.max(...maxes) : null,
      activeEnergyKcal: sumOrNull(sorted.map((w) => w.activeEnergyKcal)),
    };
  });
}

/**
 * What to do with a day's Watch summary given the lift sessions already
 * logged on that date. The Watch measured these, so its values replace typed
 * or copied ones (the logger's "repeat last session" copies the old
 * duration); a value the Watch lacks is left alone. Health Auto Export
 * resends the same workouts hourly, and an identical resend is a no-op.
 */
export function planWatchStrengthMerge(
  sessionsOnDate: Pick<
    StrengthSession,
    | "id"
    | "createdAt"
    | "durationMinutes"
    | "avgHeartRate"
    | "maxHeartRate"
    | "activeEnergyKcal"
  >[],
  workout: WatchStrengthWorkout,
  startedAtById: Record<string, string | null> = {},
): WatchStrengthPlan {
  if (sessionsOnDate.length === 0) return { kind: "create" };
  const target = [...sessionsOnDate].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )[0]!;

  const patch: WatchStrengthPatch = {};
  const currentStart = startedAtById[target.id];
  if (
    !currentStart ||
    Date.parse(currentStart) !== Date.parse(workout.startedAt)
  ) {
    patch.startedAt = workout.startedAt;
    patch.endedAt = workout.endedAt;
  }
  const fields = [
    "durationMinutes",
    "avgHeartRate",
    "maxHeartRate",
    "activeEnergyKcal",
  ] as const;
  for (const field of fields) {
    const value = workout[field];
    if (value != null && value !== target[field]) patch[field] = value;
  }
  return Object.keys(patch).length > 0
    ? { kind: "patch", sessionId: target.id, patch }
    : { kind: "none" };
}

export type CreateWatchStrengthSessionInput = {
  userId: UserId;
  sessionDate: string;
  sessionName: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  activeEnergyKcal: number | null;
  externalId: string;
};

export interface WatchStrengthRepository {
  listByDateRange(
    query: StrengthSessionDateRangeQuery,
  ): Promise<StrengthSession[]>;
  /** started_at per session id, which the domain type does not carry. */
  startedAtByIds(
    userId: UserId,
    ids: string[],
  ): Promise<Record<string, string | null>>;
  patchWatchFields(
    userId: UserId,
    id: string,
    patch: WatchStrengthPatch,
  ): Promise<void>;
  createFromWatch(
    input: CreateWatchStrengthSessionInput,
  ): Promise<StrengthSession>;
  /** True when a session, deleted ones included, came from this workout. */
  hasExternalId(userId: UserId, externalId: string): Promise<boolean>;
}

export type WatchStrengthSyncResult = {
  patched: number;
  created: number;
  unchanged: number;
};

export class WatchStrengthSyncService {
  constructor(private readonly repository: WatchStrengthRepository) {}

  /**
   * Merges each day's Watch workouts into that day's lift session, or records
   * them as a session of its own when nothing was logged in the app that day (so the
   * week plan still counts the lift). Sets logged later the same day join it
   * instead of starting a second session.
   */
  async sync(
    userId: UserId,
    workouts: unknown[],
  ): Promise<WatchStrengthSyncResult> {
    const result: WatchStrengthSyncResult = {
      patched: 0,
      created: 0,
      unchanged: 0,
    };
    const valid: WatchStrengthWorkout[] = [];
    for (const raw of workouts) {
      // One malformed workout (an out-of-range heart rate) skips itself, not
      // the batch.
      const parsed = watchStrengthWorkoutSchema.safeParse(raw);
      if (parsed.success) valid.push(parsed.data);
      else result.unchanged += 1;
    }
    for (const workout of combineWatchWorkoutsByDate(valid)) {
      const sessions = await this.repository.listByDateRange({
        userId,
        startDate: workout.localDate,
        endDate: workout.localDate,
      });
      const startedAt = await this.repository.startedAtByIds(
        userId,
        sessions.map((s) => s.id),
      );
      const plan = planWatchStrengthMerge(sessions, workout, startedAt);
      if (plan.kind === "patch") {
        await this.repository.patchWatchFields(
          userId,
          plan.sessionId,
          plan.patch,
        );
        result.patched += 1;
      } else if (
        plan.kind === "create" &&
        // A Watch-only session the user deleted stays deleted.
        !(await this.repository.hasExternalId(userId, workout.externalId))
      ) {
        await this.repository.createFromWatch({
          userId,
          sessionDate: workout.localDate,
          sessionName: `Apple Watch: ${workout.workoutType}`,
          startedAt: workout.startedAt,
          endedAt: workout.endedAt,
          durationMinutes: workout.durationMinutes,
          avgHeartRate: workout.avgHeartRate,
          maxHeartRate: workout.maxHeartRate,
          activeEnergyKcal: workout.activeEnergyKcal,
          externalId: workout.externalId,
        });
        result.created += 1;
      } else {
        result.unchanged += 1;
      }
    }
    return result;
  }
}

/** A session that holds only Watch data, waiting for sets from the logger. */
export function isWatchOnlySession(
  session: Pick<StrengthSession, "sets" | "source">,
): boolean {
  return (
    session.sets.length === 0 &&
    session.source.sourceType === "imported" &&
    session.source.sourceProvider === "apple_health"
  );
}
