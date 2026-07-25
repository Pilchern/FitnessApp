# Apple Health bridge setup (Health Auto Export or similar)

The app ingests Apple Health data via three webhooks. There is no Apple
Health API integration in the app itself — a phone-side "bridge" app (e.g.
[Health Auto Export](https://www.healthyapps.dev/)) reads HealthKit data and
POSTs it to these endpoints on a schedule or automation you configure on the
device. This doc specifies exactly what that bridge app needs to send.

Both endpoints share the same auth scheme, are excluded from the app's
session-auth middleware (see `apps/web/src/middleware.ts` matcher), and are
gated server-side by `INTEGRATION_ENCRYPTION_KEY` being configured — if that
variable isn't set, both return `503`.

## Auth model: a token scoped to YOUR account, not a shared app secret

**This changed from an earlier version of this doc.** The webhook used to be
gated by a single `APPLE_HEALTH_WEBHOOK_SECRET` environment variable shared
by every user of the app. That was a real vulnerability: since `X-User-Id`
on the request is fully client-supplied and used verbatim as the write
target, anyone who knew that one shared secret — including any other person
who simply signed up for the app, since signup is open — could write into
*any* user's sleep/activity data just by sending a request with someone
else's user id and the shared secret. There was no check that the secret
"belonged" to the user id on the request.

The fix: each user now generates their own webhook token from the
**Integrations** page (`/integrations` → Apple Health card → "Generate
webhook token"). That token is stored server-side, encrypted at rest with
`INTEGRATION_ENCRYPTION_KEY` (the same key used for Withings/Strava/Peloton
credentials), in `integration_connection_credentials`. Both auth modes below
are now checked against *your* token specifically — the server looks up the
token for whichever `X-User-Id` is on the incoming request and compares
against that, not a single global value. Knowing someone's user id is no
longer enough on its own; you'd also need their personal token.

**If you configured a bridge app before this change**, its `Authorization`
header still has the old shared secret in it, and it will start getting
`401 Unauthorized` responses. This is a one-time breaking change (deliberate
— see "Why a clean break" below): go to `/integrations`, click "Generate
webhook token" under the Apple Health card, and update your Shortcut's
`Authorization` header with the new value. Everything else (webhook URL,
`X-User-Id`, payload shape) is unchanged.

### Why a clean break instead of a grace period

This is pre-launch, single-primary-user software (see `CURRENT_STATE.md` /
`FitnessAppContext.md`) — Apple Health is "live and verified" for exactly
one real user today, not a base of bridge apps already deployed across many
people. A grace period that accepted both the old shared secret and new
per-user tokens would mean re-introducing the exact vulnerability this
change closes, just temporarily. Given the actual blast radius (one person,
one Shortcut, one header value to update), a clean break is the safer and
simpler trade — see the migration step above.

## Endpoints

| Data | Endpoint | Orchestrator | Target table |
|---|---|---|---|
| Sleep (overnight sleep stages + in-sleep vitals) | `POST /api/integrations/apple-health/sleep` | `AppleHealthSleepSyncOrchestrator` | `recovery_checkins` |
| Daily activity (steps, VO2 max, resting HR, exercise minutes, active energy) | `POST /api/integrations/apple-health/daily-metrics` | `AppleHealthDailyMetricsSyncOrchestrator` | `daily_activity_metrics` |
| Workouts (individual completed exercise sessions — cycling, running, etc.) | `POST /api/integrations/apple-health/workouts` | `AppleHealthWorkoutSyncOrchestrator` | `cardio_sessions` |

Use `https://<your-deployed-domain>/api/integrations/apple-health/sleep`,
`https://<your-deployed-domain>/api/integrations/apple-health/daily-metrics`,
and `https://<your-deployed-domain>/api/integrations/apple-health/workouts`
— substitute your actual deployed domain (e.g. your Vercel production URL).
Do not point the bridge app at a preview deployment; preview URLs change and
preview environments may not have `INTEGRATION_ENCRYPTION_KEY` configured.

## Why separate endpoints instead of one

Sleep data (sleep stages, in-sleep resting HR/HRV/respiratory rate/SpO2) is a
single overnight event that's only complete once the user wakes up, so it
naturally lands in one payload sent once per morning. Daytime activity
(steps, exercise minutes, active energy, VO2 max, general resting heart
rate) accrues continuously throughout the day and is useful to sync more
often. Workouts are discrete sessions (a ride, a run) rather than date-keyed
daily aggregates — each one gets its own row in `cardio_sessions`, deduped by
a stable per-workout identifier rather than by date. Keeping these as
separate endpoints/payload schemas/orchestrators lets each be sent on its own
cadence without one schema having to model three very different lifecycles,
and keeps `recovery_checkins` (subjective + sleep data), `daily_activity_metrics`
(whole-body daily totals), and `cardio_sessions` (individual sessions)
cleanly separated at the domain-model level.

## Getting your webhook token

1. Sign in and go to `/integrations`.
2. Find the Apple Health card and click **Generate webhook token**.
3. Copy the token shown — it is only displayed once. It's not stored in
   plaintext anywhere, so if you lose it, click "Regenerate webhook token"
   to issue a new one (this invalidates the old one — update your bridge
   app's header afterward).
4. Your `X-User-Id` (also shown on that page) does not change when you
   regenerate the token.

## Auth: two modes, pick based on what your bridge app can actually do

Both routes accept either mode (`apps/web/src/app/api/integrations/apple-health/verify-request.ts`
implements both), checked against your personal token from the step above.
**Health Auto Export and essentially every no-code export/webhook app can
only send static custom headers — they cannot compute a per-request
signature over the outgoing body at send time.** If you're using one of
those, use mode 1. Mode 2 exists for a scripted/custom client that can
compute an HMAC itself.

### Mode 1 — static bearer token (recommended for Health Auto Export)

| Header | Value |
|---|---|
| `Authorization` | `Bearer <your generated webhook token>` |
| `X-User-Id` | The app's canonical user id (uuid) this payload belongs to — must be YOUR user id; the token above is only valid for it. |
| `Content-Type` | `application/json` |

In Health Auto Export: **Automations → REST API export → Headers**, add a
custom header named `Authorization` with value `Bearer <your token>`, and a
second custom header `X-User-Id` with your user id. No signature computation
required — this is the only header config the app needs, and it's static
across every send.

This trades per-request replay protection for something a phone automation
app can actually do. It's still gated behind a long random per-user token
sent only over HTTPS, checked against the specific user id on the request —
reasonable for a personal app where the only person who can generate a
token for your account is you, authenticated. If a copy of your token ever
leaks, regenerate it from `/integrations` (this invalidates mode 2's
signatures too for your account, and requires updating the bridge app's
header).

### Mode 2 — HMAC (for scripted/custom clients only)

| Header | Value |
|---|---|
| `X-User-Id` | The app's canonical user id (uuid) this payload belongs to. |
| `X-Timestamp` | Unix epoch seconds at send time. Requests older/newer than 300s from server time are rejected (replay protection). |
| `X-Signature` | `sha256=<hex>` — see "Signature algorithm" below. |
| `Content-Type` | `application/json` |

#### Signature algorithm

1. Build the string to sign: `${userId}.${timestamp}.${rawRequestBodyString}`
   — the literal `X-User-Id` value, a `.`, the literal `X-Timestamp` value, a
   `.`, then the exact raw JSON body bytes as sent (not a re-serialized or
   reformatted version — whitespace/key order matters because the signature
   is computed over the raw bytes on both sides).
2. Compute `HMAC-SHA256(secret = <your generated webhook token>, message = <string above>)`,
   hex-encoded.
3. Send it as `X-Signature: sha256=<hex-digest>` (the `sha256=` prefix is
   optional on the wire — the server strips it if present — but including it
   is recommended for clarity).
4. The server compares using a constant-time comparison
   (`crypto.timingSafeEqual`); mismatched-length or malformed hex fails
   closed with `401`.

If both an `Authorization` header and HMAC headers are present, the server
checks `Authorization` and ignores the HMAC headers — don't send both.

The secret for both modes is your personal webhook token from
`/integrations` — never ship it inside the bridge app's public config; enter
it directly into the bridge app's custom-header field on the device.

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

### `POST /api/integrations/apple-health/workouts`

```json
{
  "workout_id": "3F2504E0-4F89-11D3-9A0C-0305E82C3301",
  "workout_type": "Cycling",
  "session_kind": "zone2",
  "start": "2026-07-25T14:00:00Z",
  "end": "2026-07-25T14:45:00Z",
  "avg_heart_rate": 142,
  "max_heart_rate": 168,
  "distance_meters": 18000,
  "source_name": "Peloton"
}
```

| Field | Type | Units | Notes |
|---|---|---|---|
| `workout_id` | string | — | required; a stable identifier for this specific workout (HealthKit assigns every workout sample a UUID — use that). This is the dedup key: resending the same `workout_id` updates the existing session instead of creating a duplicate. |
| `workout_type` | string | — | required; free text describing the activity (e.g. `"Cycling"`, `"Running"`) — stored as-is on the cardio session for display, not validated against a fixed list |
| `session_kind` | string | — | optional, one of `zone2` \| `vo2` \| `recovery` \| `other`; defaults to `zone2` if omitted (right for steady-state cardio like a Peloton ride) — set explicitly if the workout is high-intensity/interval work (`vo2`) or an easy/recovery session (`recovery`) |
| `start` | string | ISO 8601 datetime | required; workout start time |
| `end` | string | ISO 8601 datetime | optional; workout end time — if provided and `duration_minutes` is omitted, duration is computed as `end - start` |
| `duration_minutes` | number | minutes | optional, 0–1440; send this directly if your bridge app doesn't expose both `start` and `end` |
| `avg_heart_rate` | number | bpm | optional, > 0 |
| `max_heart_rate` | number | bpm | optional, > 0 |
| `distance_meters` | number | meters | optional, >= 0 |
| `source_name` | string | — | optional; which app originally wrote the workout to Apple Health (e.g. `"Peloton"`) — stored in the session notes for provenance, not used for matching/dedup |

Writes to `cardio_sessions`, deduped by `(user_id, source_provider, source_external_id)`
where `source_external_id` is `workout_id` — unlike the date-keyed sleep and
daily-metrics endpoints, this is genuinely session-based, so multiple
workouts on the same day each get their own row.

This is how a Peloton ride reaches this app for free, without a Strava
subscription: the Peloton app writes each completed ride to Apple Health
automatically (a setting in the Peloton app itself), and your bridge app's
"Workouts" export then forwards it here. This works for any activity type
that ends up in Apple Health, not just Peloton.

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
- **Workouts**: as soon as possible after each workout finishes (e.g. an
  automation triggered on new HealthKit workout data), or at minimum once
  nightly. Since dedup is per-`workout_id` rather than per-date, sending the
  same workout multiple times (e.g. once right after and again in a nightly
  catch-up sync) is always safe — it updates the same row rather than
  creating a duplicate.

## Storage and implementation notes

- Per-user tokens live in `integration_connection_credentials` (the same
  table Withings/Strava/Peloton use for OAuth token pairs), keyed by
  `(integration_connection_id)` with a `(user_id, provider)` index. For
  Apple Health, `access_token_encrypted` holds the encrypted webhook token,
  `token_type` is `"webhook_bearer"`, and `refresh_token_encrypted` is
  unused (`null`). This table was already RLS-protected and already
  encrypted at rest with `INTEGRATION_ENCRYPTION_KEY`, so reusing it avoided
  standing up a new table for a single opaque value — see
  `packages/infrastructure/src/repositories/integration-credential-repository.ts`
  (`getByUserAndProvider`) and `apps/web/src/lib/server/integrations.ts`
  (`generateAppleHealthWebhookToken`, `createAppleHealthWebhookSecretLookup`).
- Generating a token auto-creates the `apple_health` row in
  `integration_connections` if one doesn't exist yet for that user (same
  auto-creation behavior the sync orchestrators already had on first
  webhook call).
- `verify-request.ts`'s `verifyAppleHealthRequest` takes an injected
  `lookupSecret: (userId: string) => Promise<string | null>` function
  instead of a raw secret string, specifically so it stays unit-testable
  without a real Supabase connection (see
  `apps/web/src/app/api/integrations/apple-health/verify-request.test.ts`,
  which mocks the lookup with an in-memory map).

## Verifying configuration

`hasAppleHealthServerEnv()` (`apps/web/src/lib/server/env.ts`) checks that
`INTEGRATION_ENCRYPTION_KEY` is set — that's the only environment-level
requirement left; per-user webhook tokens are generated from the UI, not
configured via environment variable. A request sent before
`INTEGRATION_ENCRYPTION_KEY` is configured gets `503 { ok: false, error:
"Apple Health webhook is not configured." }`. A request sent with a valid
`X-User-Id` that hasn't generated a token yet (or the wrong token) gets
`401`.
