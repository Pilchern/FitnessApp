import { z } from "zod";
import type {
  BodyMetricsProviderAdapter,
  MappedImportedBodyMetric,
  OAuthExchangeResult,
  OAuthTokenSet,
  ProviderOAuthConfig,
  ProviderRawImportItem,
} from "../../shared/provider-types";

const AUTHORIZE_URL = "https://account.withings.com/oauth2_user/authorize2";
const TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const MEASURE_URL = "https://wbsapi.withings.net/measure";
const KG_TO_LB = 2.2046226218;

const withingsTokenResponseSchema = z.object({
  status: z.number(),
  body: z.object({
    access_token: z.string(),
    refresh_token: z.string().optional(),
    expires_in: z.number().int().positive().optional(),
    scope: z.string().optional(),
    token_type: z.string().optional(),
    userid: z.union([z.string(), z.number()]).optional(),
  }),
  error: z.string().optional(),
});

const withingsMeasureSchema = z.object({
  type: z.number().int(),
  value: z.number(),
  unit: z.number().int(),
});

const withingsMeasureGroupSchema = z.object({
  grpid: z.union([z.string(), z.number()]),
  date: z.number().int(),
  measures: withingsMeasureSchema.array(),
  category: z.number().int().optional(),
});

const withingsMeasureResponseSchema = z.object({
  status: z.number(),
  body: z.object({
    updatetime: z.number().int().optional(),
    measuregrps: withingsMeasureGroupSchema.array().default([]),
  }),
  error: z.string().optional(),
});

function epochSecondsToIso(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

function isoDateFromEpoch(seconds: number) {
  return epochSecondsToIso(seconds).slice(0, 10);
}

function decimalFromMeasure(value: number, unit: number) {
  return value * 10 ** unit;
}

function formatKgToLb(value: number | null) {
  if (value == null) {
    return null;
  }

  return Number((value * KG_TO_LB).toFixed(2));
}

async function parseJsonResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Withings request failed with status ${response.status}.`);
  }

  return response.json();
}

export class WithingsBodyMetricsAdapter implements BodyMetricsProviderAdapter {
  readonly provider = "withings" as const;
  readonly displayName = "Withings";
  readonly capabilities = ["body_metrics"];

  constructor(private readonly config: ProviderOAuthConfig) {}

  buildAuthorizationUrl(input: { state: string }) {
    const searchParams = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      scope: "user.metrics",
      redirect_uri: this.config.redirectUri,
      state: input.state,
    });

    return `${AUTHORIZE_URL}?${searchParams.toString()}`;
  }

  async exchangeCode(input: { code: string }): Promise<OAuthExchangeResult> {
    const searchParams = new URLSearchParams({
      action: "requesttoken",
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: input.code,
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: searchParams,
      cache: "no-store",
    });

    const parsed = withingsTokenResponseSchema.parse(
      await parseJsonResponse(response),
    );

    if (parsed.status !== 0) {
      throw new Error(parsed.error ?? "Withings token exchange failed.");
    }

    return {
      accountLabel: "Withings body metrics",
      providerUserId: parsed.body.userid ? String(parsed.body.userid) : null,
      metadata: {},
      tokenSet: this.mapTokenSet(parsed.body),
    };
  }

  async refreshToken(input: { refreshToken: string }): Promise<OAuthTokenSet> {
    const searchParams = new URLSearchParams({
      action: "requesttoken",
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: input.refreshToken,
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: searchParams,
      cache: "no-store",
    });

    const parsed = withingsTokenResponseSchema.parse(
      await parseJsonResponse(response),
    );

    if (parsed.status !== 0) {
      throw new Error(parsed.error ?? "Withings token refresh failed.");
    }

    return this.mapTokenSet(parsed.body);
  }

  async fetchBodyMetrics(input: {
    accessToken: string;
    lastCursor?: string | null;
  }) {
    const searchParams = new URLSearchParams({
      action: "getmeas",
      access_token: input.accessToken,
    });

    if (input.lastCursor) {
      searchParams.set("lastupdate", input.lastCursor);
    }

    const response = await fetch(MEASURE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: searchParams,
      cache: "no-store",
    });

    const parsed = withingsMeasureResponseSchema.parse(
      await parseJsonResponse(response),
    );

    if (parsed.status !== 0) {
      throw new Error(parsed.error ?? "Withings body metric import failed.");
    }

    return {
      items: parsed.body.measuregrps.map((group) => ({
        providerEventType: "measure_group",
        providerExternalId: String(group.grpid),
        occurredAt: epochSecondsToIso(group.date),
        payload: group,
      })),
      nextCursor: parsed.body.updatetime ? String(parsed.body.updatetime) : null,
      metadata: {
        fetchedItemCount: parsed.body.measuregrps.length,
      },
    };
  }

  mapRawBodyMetricItem(
    item: ProviderRawImportItem,
    context: { importBatchId: string; rawImportEventId: string },
  ): MappedImportedBodyMetric | null {
    const payload = withingsMeasureGroupSchema.parse(item.payload);
    let weightKg: number | null = null;
    let bodyFatPct: number | null = null;
    let muscleMassKg: number | null = null;
    let boneMassKg: number | null = null;
    let fatFreeMassKg: number | null = null;
    let hydrationPct: number | null = null;
    let visceralFatIndex: number | null = null;

    for (const measure of payload.measures) {
      const normalized = decimalFromMeasure(measure.value, measure.unit);

      if (measure.type === 1) {
        weightKg = Number(normalized.toFixed(2));
      } else if (measure.type === 5) {
        fatFreeMassKg = Number(normalized.toFixed(2));
      } else if (measure.type === 6) {
        bodyFatPct = Number(normalized.toFixed(2));
      } else if (measure.type === 9) {
        // Type 88 is preferred; only use type 9 if type 88 hasn't been set yet
        if (boneMassKg == null) {
          boneMassKg = Number(normalized.toFixed(3));
        }
      } else if (measure.type === 76) {
        muscleMassKg = Number(normalized.toFixed(2));
      } else if (measure.type === 77) {
        hydrationPct = Number(normalized.toFixed(2));
      } else if (measure.type === 88) {
        // Preferred over type 9 — overwrite regardless of order
        boneMassKg = Number(normalized.toFixed(3));
      } else if (measure.type === 170) {
        // Visceral fat index is already an integer rating — no decimal conversion needed
        visceralFatIndex = Math.round(normalized);
      }
    }

    if (
      weightKg == null &&
      bodyFatPct == null &&
      muscleMassKg == null &&
      boneMassKg == null &&
      fatFreeMassKg == null &&
      hydrationPct == null &&
      visceralFatIndex == null
    ) {
      return null;
    }

    return {
      measuredOn: isoDateFromEpoch(payload.date),
      weightKg,
      weightLb: formatKgToLb(weightKg),
      waistIn: null,
      waistCm: null,
      bodyFatPct,
      muscleMassKg,
      muscleMassLb: formatKgToLb(muscleMassKg),
      boneMassKg,
      boneMassLb: formatKgToLb(boneMassKg),
      fatFreeMassKg,
      fatFreeMassLb: formatKgToLb(fatFreeMassKg),
      hydrationPct,
      visceralFatIndex,
      notes: null,
      providerExternalId: item.providerExternalId,
    };
  }

  private mapTokenSet(body: z.infer<typeof withingsTokenResponseSchema>["body"]): OAuthTokenSet {
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      accessTokenExpiresAt: body.expires_in
        ? new Date(Date.now() + body.expires_in * 1000).toISOString()
        : null,
      refreshTokenExpiresAt: null,
      tokenType: body.token_type ?? null,
      scopes: body.scope
        ? body.scope
            .split(",")
            .map((scope) => scope.trim())
            .filter(Boolean)
        : [],
    };
  }
}
