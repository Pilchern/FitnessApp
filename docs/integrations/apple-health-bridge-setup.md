# Apple Health bridge setup (Health Auto Export or similar)

The app ingests Apple Health data via two HMAC-signed webhooks. There is no
Apple Health API integration in the app itself — a phone-side "bridge" app
(e.g. [Health Auto Export](https://www.healthyapps.dev/)) reads HealthKit
data and POSTs it to these endpoints on a schedule or automation you
configure on the device. This doc specifies exactly what that bridge app
needs to send.

Both endpoints share the same signing scheme, are excluded from the app's
session-auth middleware (see `apps/web/src/middleware.ts` matcher), and are
gated server-side by the `APPLE_HEALTH_WEBHOOK_SECRET` environment variable —
if that variable isn't set, both return `503`.

## Endpoints

| Data | Endpoint | Orchestrator | Target table |
|---|---|---|---|
| Sleep (overnight sleep stages + in-sleep vitals) | `POST /api/integrations/apple-health/sleep` | `AppleHealthSleepSyncOrchestrator` | `recovery_checkins` |
| Daily activity (steps, VO2 max, resting HR, exercise minutes, active energy) | `POST /api/integrations/apple-health/daily-metrics` | `AppleHealthDailyMetricsSyncOrchestrator` | `daily_activity_metrics` |

Use `https://<your-deployed-domain>/api/integrations/apple-health/sleep` and
`https://<your-deployed-domain>/api/integrations/apple-health/daily-metrics`
— substitute your actual deployed domain (e.g. your Vercel production URL).
Do not point the bridge app at a preview deployment; preview URLs change and
preview environments may not have `APPLE_HEALTH_WEBHOOK_SECRET` configured.

## Why two separate endpoints instead of one

Sleep data (sleep stages, in-sleep resting HR/HRV/respiratory rate/SpO2) is a
single overnight event that's only complete once the user wakes up, so it
naturally lands in one payload sent once per morning. Daytime activity
(steps, exercise minutes, active energy, VO2 max, general resting heart
rate) accrues continuously throughout the day and is useful to sync more
often. Keeping them as separate endpoints/payload schemas/orchestrators lets
each be sent on its own cadence without one schema having to model two very
different lifecycles, and keeps `recovery_checkins` (subjective + sleep data)
cleanly separated from `daily_activity_metrics` (whole-body daily activity
data) at the domain-model level.

## Required headers (both endpoints)

| Header | Value |
|---|---|
| `X-User-Id` | The app's canonical user id (uuid) this payload belongs to. |
| `X-Timestamp` | Unix epoch seconds at send time. Requests older/newer than 300s from server time are rejected (replay protection). |
| `X-Signature` | `sha256=<hex>` — see "Signature algorithm" below. |
| `Content-Type` | `application/json` |

### Signature algorithm

Both routes verify the signature identically
(`apps/web/src/app/api/integrations/apple-health/sleep/route.ts` and
`.../daily-metrics/route.ts`):

1. Build the string to sign: `${userId}.${timestamp}.${rawRequestBodyString}`
   — the literal `X-User-Id` value, a `.`, the literal `X-Timestamp` value, a
   `.`, then the exact raw JSON body bytes as sent (not a re-serialized or
   reformatted version — whitespace/key order matters because the signature
   is computed over the raw bytes on both sides).
2. Compute `HMAC-SHA256(secret = APPLE_HEALTH_WEBHOOK_SECRET, message = <string above>)`,
   hex-encoded.
3. Send it as `X-Signature: sha256=<hex-digest>` (the `sha256=` prefix is
   optional on the wire — the server strips it if present — but including it
   is recommended for clarity).
4. The server compares using a constant-time comparison
   (`crypto.timingSafeEqual`); mismatched-length or malformed hex fails
   closed with `401`.

The shared secret is `APPLE_HEALTH_WEBHOOK_SECRET`, configured as a server
environment variable — never ship it inside the bridge app's public config;
enter it directly into the bridge app's "custom header"/"signature secret"
field on the device.

## Payload shapes

Both endpoints accept either a single JSON object or a JSON array of
objects (for backfilling multiple days in one request).

### `POST /api/integrations/apple-health/sleep`

```json
{
  "date": "2026-07-15",
  "time_in_bed_minutes": 480,
  "sleep_duration_minutes": 435,
  "deep_sleep_minutes": 90,
  "rem_sleep_minutes": 110,
  "core_sleep_minutes": 220,
  "awake_minutes": 15,
  "sleep_efficiency_pct": 90.6,
  "resting_heart_rate": 54,
  "hrv": 62.3,
  "sleep_hrv_avg": 58.1,
  "sleep_avg_heart_rate": 57,
  "sleep_respiratory_rate": 14.2,
  "sleep_spo2_avg_pct": 97.5
}
```

| Field | Type | Units | Notes |
|---|---|---|---|
| `date` | string | `YYYY-MM-DD` | required; the sleep night's date (the date the user woke up, matching Apple Health's convention) |
| `time_in_bed_minutes` | number | minutes | optional, 0–1440 |
| `sleep_duration_minutes` | number | minutes | optional, 0–1440 |
| `deep_sleep_minutes` | number | minutes | optional, 0–1440 |
| `rem_sleep_minutes` | number | minutes | optional, 0–1440 |
| `core_sleep_minutes` | number | minutes | optional, 0–1440 |
| `awake_minutes` | number | minutes | optional, 0–1440 |
| `sleep_efficiency_pct` | number | percent | optional, 0–100 |
| `resting_heart_rate` | number | bpm | optional; in-sleep resting HR |
| `hrv` | number | ms | optional |
| `sleep_hrv_avg` | number | ms | optional |
| `sleep_avg_heart_rate` | number | bpm | optional |
| `sleep_respiratory_rate` | number | breaths/min | optional |
| `sleep_spo2_avg_pct` | number | percent | optional, 0–100 |

Writes to `recovery_checkins`, keyed by `(user_id, checkin_date)` — resending
the same date updates the existing row (fields not present in the payload
are left unchanged) rather than creating a duplicate.

### `POST /api/integrations/apple-health/daily-metrics`

```json
{
  "date": "2026-07-15",
  "steps": 8123,
  "vo2_max": 42.5,
  "resting_heart_rate": 55,
  "exercise_minutes": 35,
  "active_energy_kcal": 512.4
}
```

| Field | Type | Units | Notes |
|---|---|---|---|
| `date` | string | `YYYY-MM-DD` | required; the calendar day these totals belong to |
| `steps` | integer | count | optional, >= 0 |
| `vo2_max` | number | mL/kg/min | optional, > 0 |
| `resting_heart_rate` | number | bpm | optional, > 0; the general (non-sleep) daily resting heart rate, distinct from `sleep.resting_heart_rate` above which is measured during sleep |
| `exercise_minutes` | number | minutes | optional, 0–1440; Apple's "Exercise" ring minutes |
| `active_energy_kcal` | number | kcal | optional, >= 0; Apple's "Move" ring active energy |

Writes to `daily_activity_metrics`, keyed by `(user_id, metric_date)` — same
upsert-by-date semantics as the sleep endpoint.

## Recommended send frequency

- **Sleep**: once daily, shortly after wake (e.g. an automation triggered at
  a fixed morning time, or "on unlock" the first time after ~6am). Sleep data
  for a given night is only complete once the user has woken up, so sending
  more often than once a day provides no benefit and just adds duplicate
  webhook calls that the server will de-dupe anyway.
- **Daily activity**: every 4-6 hours through the day, or at minimum once
  nightly before bed. Unlike sleep, activity totals (steps, exercise
  minutes, active energy) accrue continuously — sending a few times a day
  keeps the dashboard closer to real-time without over-polling. A single
  once-nightly send is also acceptable if battery/automation simplicity is
  preferred; the endpoint's upsert-by-date behavior makes either cadence
  safe to mix.

## Verifying configuration

`hasAppleHealthWebhookEnv()` (`apps/web/src/lib/server/env.ts`) gates both
orchestrators — set `APPLE_HEALTH_WEBHOOK_SECRET` in your deployment
environment before pointing a bridge app at either endpoint. A request sent
before the secret is configured gets `503 { ok: false, error: "Apple Health
webhook is not configured." }`.
