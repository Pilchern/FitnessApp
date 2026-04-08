import { z } from "zod";
import type {
  MapRawBodyMetricContext,
  MappedImportedCardioSession,
  OAuthCardioProviderAdapter,
  OAuthExchangeResult,
  OAuthTokenSet,
  ProviderCardioImportPage,
  ProviderOAuthConfig,
  ProviderRawImportItem,
} from "../../shared/provider-types";

const STRAVA_API = "https://www.strava.com/api/v3";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_SCOPE = "activity:read_all";

// ---------------------------------------------------------------------------
// API response schemas
// ---------------------------------------------------------------------------

const stravaTokenResponseSchema = z.object({
  token_type: z.string(),
  expires_at: z.number().int(),
  refresh_token: z.string(),
  access_token: z.string(),
  athlete: z
    .object({
      id: z.number().int(),
      username: z.string().nullable().optional(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
    })
    .optional(),
});

const stravaActivitySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    sport_type: z.string(),
    trainer: z.boolean().optional().default(false),
    start_date: z.string(),
    elapsed_time: z.number().int(),
    moving_time: z.number().int().optional(),
    distance: z.number().optional().default(0),
    average_heartrate: z.number().nullable().optional(),
    max_heartrate: z.number().nullable().optional(),
    average_watts: z.number().nullable().optional(),
    average_cadence: z.number().nullable().optional(),
    kilojoules: z.number().nullable().optional(),
    suffer_score: z.number().nullable().optional(),
  })
  .passthrough();

type StravaRawActivity = z.infer<typeof stravaActivitySchema>;

// ---------------------------------------------------------------------------
// Session kind inference
// ---------------------------------------------------------------------------

type CardioSessionKind = "zone2" | "vo2" | "recovery" | "other";

function inferSessionKind(activity: StravaRawActivity): CardioSessionKind {
  const title = (activity.name ?? "").toLowerCase();
  const sport = (activity.sport_type ?? "").toLowerCase();
  const watts = activity.average_watts ?? 0;

  // Explicit recovery signals
  if (/recovery|active recovery|easy|flush|cool.?down/.test(title)) return "recovery";

  // Yoga, pilates, stretching, mobility
  if (/yoga|pilates|stretch|mobility|meditat/.test(title)) return "recovery";
  if (/yoga|pilates/.test(sport)) return "recovery";

  // High intensity signals
  if (/hiit|tabata|sprint|interval|threshold|tempo|race|5k|10k|half marathon|marathon|vo2|max effort|all out/.test(title)) return "vo2";
  if (/hiit|crossfit/.test(sport)) return "vo2";

  // Strength/weight training → other
  if (/weight|strength|lift|gym|cross.?train|circuit/.test(title)) return "other";
  if (/weighttraining|crossfit|workout/.test(sport)) return "other";

  // Walk/hike → zone2
  if (/walk|hike|trek/.test(sport)) return "zone2";

  // Run inference
  if (/run/.test(sport)) {
    if (/easy|recovery|jog|base|aerobic|zone 2|z2/.test(title)) return "zone2";
    if (/tempo|threshold|interval|fartlek|speed|fast|race|parkrun/.test(title)) return "vo2";
    return "zone2"; // default runs to zone2
  }

  // Swim inference
  if (/swim/.test(sport)) {
    if (/easy|recovery|drill|technique/.test(title)) return "zone2";
    return "vo2"; // default swims to vo2
  }

  // Rowing
  if (/row/.test(sport)) {
    if (/easy|recovery|steady/.test(title)) return "zone2";
    return "vo2";
  }

  // Cycling inference (original logic)
  if (/ride|cycle|cycling/.test(sport)) {
    if (/power zone max|pz max|tabata|hiit|sprint|vo2|threshold|climbing/.test(title)) return "vo2";
    if (/recovery|active recovery/.test(title)) return "recovery";
    if (/low impact|zone 2|endurance|base|aerobic|fun ride/.test(title)) return "zone2";
    if (watts >= 175) return "vo2";
    if (watts > 0) return "zone2";
    return "zone2";
  }

  return "other";
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function stravaFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {},
) {
  const response = await fetch(`${STRAVA_API}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Strava API error ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

async function exchangeToken(
  config: ProviderOAuthConfig,
  body: Record<string, string>,
): Promise<z.infer<typeof stravaTokenResponseSchema>> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, ...body }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Strava token error ${response.status}: ${text.slice(0, 200)}`);
  }

  return stravaTokenResponseSchema.parse(await response.json());
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class StravaCardioAdapter implements OAuthCardioProviderAdapter {
  readonly provider = "strava" as const;
  readonly displayName = "Strava";
  readonly capabilities = ["cardio_sessions"];

  constructor(private readonly config: ProviderOAuthConfig) {}

  buildAuthorizationUrl(input: { state: string }): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      approval_prompt: "auto",
      scope: STRAVA_SCOPE,
      state: input.state,
    });
    return `${STRAVA_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(input: { code: string }): Promise<OAuthExchangeResult> {
    const data = await exchangeToken(this.config, {
      code: input.code,
      grant_type: "authorization_code",
    });

    const athlete = data.athlete;
    const athleteName = athlete
      ? [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") ||
        athlete.username ||
        null
      : null;

    return {
      accountLabel: athleteName ? `Strava (${athleteName})` : "Strava",
      providerUserId: athlete ? String(athlete.id) : null,
      metadata: athlete
        ? { athleteId: athlete.id, username: athlete.username ?? null }
        : {},
      tokenSet: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        accessTokenExpiresAt: new Date(data.expires_at * 1000).toISOString(),
        refreshTokenExpiresAt: null,
        tokenType: data.token_type,
        scopes: [STRAVA_SCOPE],
      },
    };
  }

  async refreshToken(input: { refreshToken: string }): Promise<OAuthTokenSet> {
    const data = await exchangeToken(this.config, {
      refresh_token: input.refreshToken,
      grant_type: "refresh_token",
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiresAt: new Date(data.expires_at * 1000).toISOString(),
      refreshTokenExpiresAt: null,
      tokenType: data.token_type,
      scopes: [STRAVA_SCOPE],
    };
  }

  async fetchCardioSessions(input: {
    accessToken: string;
    providerUserId: string;
    lastCursor?: string | null;
  }): Promise<ProviderCardioImportPage> {
    const PAGE_SIZE = 200;
    const allItems: ProviderRawImportItem[] = [];
    let page = 1;
    let hasMore = true;

    // cursor is epoch seconds as string; 0 = fetch all
    const afterEpoch = input.lastCursor ? parseInt(input.lastCursor, 10) : 0;

    while (hasMore) {
      const qs = new URLSearchParams({
        per_page: String(PAGE_SIZE),
        page: String(page),
      });

      if (afterEpoch > 0) {
        qs.set("after", String(afterEpoch));
      }

      const activities = await stravaFetch(`/athlete/activities?${qs}`, input.accessToken);
      const parsed = z.array(stravaActivitySchema).parse(activities);

      for (const activity of parsed) {
        allItems.push({
          providerEventType: "strava_activity",
          providerExternalId: String(activity.id),
          occurredAt: activity.start_date,
          payload: activity as Record<string, unknown>,
        });
      }

      hasMore = parsed.length === PAGE_SIZE;
      page += 1;
    }

    // cursor = epoch seconds of the most recent activity we fetched
    const nextCursor =
      allItems.length > 0 && allItems[0].occurredAt
        ? String(Math.floor(new Date(allItems[0].occurredAt).getTime() / 1000))
        : null;

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
    const activity = stravaActivitySchema.parse(item.payload);

    const durationMinutes = Math.round(activity.elapsed_time / 60);
    const sessionKind = inferSessionKind(activity);
    const zone2Minutes = sessionKind === "zone2" ? durationMinutes : null;

    const sessionDate = activity.start_date.slice(0, 10);
    const startedAt = activity.start_date;

    const distanceMeters =
      activity.distance && activity.distance > 0
        ? Math.round(activity.distance)
        : null;

    // Avg cadence — Strava reports cadence averaged over moving time
    const cadenceMin = activity.average_cadence
      ? Math.round(activity.average_cadence)
      : null;

    // Avg watts stored as avg_output; Strava has no separate min/max resistance
    const avgOutput = activity.average_watts
      ? Number(activity.average_watts.toFixed(1))
      : null;

    const notes = `Strava: ${activity.name}`;

    return {
      sessionDate,
      startedAt,
      endedAt: null,
      sessionKind,
      plannedVsCompleted: "completed",
      durationMinutes,
      zone2Minutes,
      avgHeartRate: activity.average_heartrate
        ? Math.round(activity.average_heartrate)
        : null,
      maxHeartRate: activity.max_heartrate
        ? Math.round(activity.max_heartrate)
        : null,
      avgOutput,
      cadenceMin,
      cadenceMax: null,
      resistanceMin: null,
      resistanceMax: null,
      distanceMeters,
      notes,
      sportType: activity.sport_type ?? null,
      providerExternalId: item.providerExternalId,
    };
  }
}
