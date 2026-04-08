import { z } from "zod";
import type {
  CardioProviderAdapter,
  MapRawBodyMetricContext,
  MappedImportedCardioSession,
  ProviderCardioImportPage,
  ProviderRawImportItem,
} from "../../shared/provider-types";

const PELOTON_API = "https://api.onepeloton.com";

// ---------------------------------------------------------------------------
// API response schemas
// ---------------------------------------------------------------------------

const pelotonAuthResponseSchema = z.object({
  user_id: z.string(),
  session_id: z.string(),
});

const pelotonRideSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    duration: z.number().optional(),
    difficulty_estimate: z.number().nullable().optional(),
    fitness_discipline: z.string().optional(),
  })
  .passthrough();

const pelotonWorkoutSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    created_at: z.number(),
    start_time: z.number().nullable().optional(),
    end_time: z.number().nullable().optional(),
    status: z.string(),
    fitness_discipline: z.string().optional(),
    name: z.string().optional(),
    duration: z.number().nullable().optional(),
    avg_heart_rate: z.number().nullable().optional(),
    max_heart_rate: z.number().nullable().optional(),
    total_output: z.number().nullable().optional(),
    avg_cadence: z.number().nullable().optional(),
    max_cadence: z.number().nullable().optional(),
    avg_resistance: z.number().nullable().optional(),
    max_resistance: z.number().nullable().optional(),
    avg_speed: z.number().nullable().optional(),
    distance: z.number().nullable().optional(),
    ride: pelotonRideSchema.nullable().optional(),
  })
  .passthrough();

const pelotonWorkoutListResponseSchema = z.object({
  data: pelotonWorkoutSchema.array(),
  total: z.number().int(),
  count: z.number().int(),
  page: z.number().int(),
  page_count: z.number().int(),
  sort_by: z.string().optional(),
  desc: z.boolean().optional(),
});

type PelotonWorkout = z.infer<typeof pelotonWorkoutSchema>;

// ---------------------------------------------------------------------------
// Session kind inference
// ---------------------------------------------------------------------------

type CardioSessionKind = "zone2" | "vo2" | "recovery" | "other";

function inferSessionKind(workout: PelotonWorkout): CardioSessionKind {
  const title = (workout.ride?.title ?? workout.name ?? "").toLowerCase();

  // Recovery rides — explicit recovery tag or low-output recovery class
  if (title.includes("recovery")) return "recovery";

  // VO2 / high-intensity
  if (
    title.includes("hiit") ||
    title.includes("tabata") ||
    title.includes("sprint") ||
    title.includes("power zone max") ||
    title.includes("intervals & arms") ||
    (title.includes("intervals") && !title.includes("endurance"))
  ) {
    return "vo2";
  }

  // Zone 2 / sustained aerobic
  if (
    title.includes("low impact") ||
    title.includes("power zone endurance") ||
    title.includes("endurance") ||
    title.includes("fun ride")
  ) {
    return "zone2";
  }

  // Mixed Power Zone and Climb — treat as vo2 (high sustained output)
  if (title.includes("climb") || title.includes("power zone")) {
    return "vo2";
  }

  // Fall back to difficulty estimate
  const difficulty = workout.ride?.difficulty_estimate ?? null;
  if (difficulty == null) return "other";
  if (difficulty <= 5.5) return "zone2";
  if (difficulty <= 7.5) return "zone2"; // moderate aerobic
  return "vo2";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function epochToIsoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function epochToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

async function pelotonFetch(
  path: string,
  options: RequestInit & { sessionToken?: string } = {},
) {
  const { sessionToken, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };
  if (sessionToken) {
    headers["Cookie"] = `peloton_session_id=${sessionToken}`;
  }

  const response = await fetch(`${PELOTON_API}${path}`, {
    ...fetchOptions,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Peloton API error ${response.status}: ${text.slice(0, 200)}`,
    );
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class PelotonCardioAdapter implements CardioProviderAdapter {
  readonly provider = "peloton" as const;
  readonly displayName = "Peloton";
  readonly capabilities = ["cardio_sessions"];

  async authenticate(input: {
    username: string;
    password: string;
  }): Promise<{ sessionToken: string; providerUserId: string }> {
    const data = await pelotonFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username_or_email: input.username,
        password: input.password,
      }),
    });

    const parsed = pelotonAuthResponseSchema.parse(data);
    return {
      sessionToken: parsed.session_id,
      providerUserId: parsed.user_id,
    };
  }

  async fetchCardioSessions(input: {
    sessionToken: string;
    providerUserId: string;
    lastCursor?: string | null;
  }): Promise<ProviderCardioImportPage> {
    const PAGE_SIZE = 100;
    const allItems: ProviderRawImportItem[] = [];
    let page = 0;
    let hasMore = true;

    // lastCursor is the ISO timestamp of the oldest already-synced workout.
    // We stop paginating when we hit workouts older than that.
    const sinceMs = input.lastCursor ? new Date(input.lastCursor).getTime() : 0;

    while (hasMore) {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
        joins: "ride",
        sort_by: "created_at",
        desc: "true",
      });

      const data = await pelotonFetch(
        `/api/user/${input.providerUserId}/workouts?${qs}`,
        { sessionToken: input.sessionToken },
      );

      const parsed = pelotonWorkoutListResponseSchema.parse(data);

      let hitCursor = false;
      for (const workout of parsed.data) {
        // Only sync completed cycling workouts
        if (workout.status !== "COMPLETE") continue;
        if (workout.fitness_discipline && workout.fitness_discipline !== "cycling") continue;

        const workoutMs = workout.start_time
          ? workout.start_time * 1000
          : workout.created_at * 1000;

        if (workoutMs <= sinceMs) {
          hitCursor = true;
          break;
        }

        allItems.push({
          providerEventType: "peloton_workout",
          providerExternalId: workout.id,
          occurredAt: workout.start_time
            ? epochToIso(workout.start_time)
            : epochToIso(workout.created_at),
          payload: workout,
        });
      }

      const totalFetched = (page + 1) * PAGE_SIZE;
      hasMore =
        !hitCursor &&
        parsed.data.length === PAGE_SIZE &&
        totalFetched < parsed.total;
      page += 1;
    }

    // Next cursor = ISO timestamp of the most recent workout we fetched
    const nextCursor =
      allItems.length > 0 ? (allItems[0].occurredAt ?? null) : null;

    return {
      items: allItems,
      nextCursor,
      metadata: { fetchedItemCount: allItems.length },
    };
  }

  mapRawCardioItem(
    item: ProviderRawImportItem,
    _context: MapRawBodyMetricContext,
  ): MappedImportedCardioSession | null {
    const workout = pelotonWorkoutSchema.parse(item.payload);

    // Skip non-cycling or incomplete workouts (defensive — already filtered above)
    if (workout.status !== "COMPLETE") return null;

    const durationSeconds = workout.duration ?? workout.ride?.duration ?? null;
    const durationMinutes = durationSeconds
      ? Math.round(durationSeconds / 60)
      : null;

    const sessionKind = inferSessionKind(workout);
    const zone2Minutes =
      sessionKind === "zone2" ? durationMinutes : null;

    const sessionDate = workout.start_time
      ? epochToIsoDate(workout.start_time)
      : epochToIsoDate(workout.created_at);

    const startedAt = workout.start_time ? epochToIso(workout.start_time) : null;
    const endedAt = workout.end_time ? epochToIso(workout.end_time) : null;

    // Peloton resistance is 0-100 percentage; store as-is
    const resistanceMin = workout.avg_resistance
      ? Number(workout.avg_resistance.toFixed(1))
      : null;
    const resistanceMax = workout.max_resistance
      ? Number(workout.max_resistance.toFixed(1))
      : null;

    // Cadence
    const cadenceMin = workout.avg_cadence
      ? Math.round(workout.avg_cadence)
      : null;
    const cadenceMax = workout.max_cadence
      ? Math.round(workout.max_cadence)
      : null;

    // Output — Peloton reports total_output in kJ; convert to avg watts
    const avgOutput =
      workout.total_output && durationSeconds
        ? Number(((workout.total_output * 1000) / durationSeconds).toFixed(1))
        : null;

    // Distance — Peloton reports miles; convert to meters
    const distanceMeters = workout.distance
      ? Math.round(workout.distance * 1609.344)
      : null;

    const notes = workout.ride?.title
      ? `Peloton: ${workout.ride.title}`
      : null;

    return {
      sessionDate,
      startedAt,
      endedAt,
      sessionKind,
      plannedVsCompleted: "completed",
      durationMinutes,
      zone2Minutes,
      avgHeartRate: workout.avg_heart_rate
        ? Math.round(workout.avg_heart_rate)
        : null,
      maxHeartRate: workout.max_heart_rate
        ? Math.round(workout.max_heart_rate)
        : null,
      avgOutput,
      cadenceMin,
      cadenceMax,
      resistanceMin,
      resistanceMax,
      distanceMeters,
      notes,
      providerExternalId: item.providerExternalId,
    };
  }
}
