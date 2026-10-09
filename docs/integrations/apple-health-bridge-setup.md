# Apple Health bridge setup

The app has no Apple Health API of its own. A phone-side bridge reads
HealthKit and POSTs JSON to the webhooks below. The Apple Watch writes steps,
sleep, resting HR, HRV and VO2 max to Health; the Peloton app writes rides to
Health (Peloton app > Settings > Apple Health > allow write). Withings syncs
directly (OAuth, weekly pg_cron) and is not read from Apple Health.

## Quick setup (about five minutes)

### 0. Once, in the app

1. Open `/integrations` on the production URL, Apple Health card, tap
   **Generate webhook token**. Copy it into your password manager; it is shown
   once. As of 2026-10-09 no token exists yet.
2. Copy the **X-User-Id** shown on the same card.

Every request below sends these headers:

| Header | Value |
|---|---|
| `Authorization` | `Bearer <webhook token>` |
| `X-User-Id` | `<user id from the card>` |
| `Content-Type` | `application/json` |

If production is ever put behind Vercel Authentication, also send
`x-vercel-protection-bypass: <Protection Bypass for Automation secret>`
(Vercel > Project > Settings > Deployment Protection). Today the production
domain is not behind it.

### Option A (free): two Apple Shortcuts automations

Covers steps (auto-ticks the steps habit), resting HR, VO2 max, sleep and
HRV. Does not cover rides: log those with the cardio quick log (tap the
template, save). HealthKit is unreadable while the phone is locked, so both
automations run at times the phone is normally in hand.

Shortcut 1, "Fitness evening" (Shortcuts > Automation > Time of Day > 8:35 PM
daily > Run Immediately, notifications off):

1. Find Health Samples: Type **Steps**, Start Date **is today**. Then
   Calculate Statistics: **Sum**. Name the result `Steps`.
2. Find Health Samples: Type **Resting Heart Rate**, Start Date **is in the
   last 1 days**, Sort by **End Date**, Latest First, Limit **1**. Name it `RHR`.
3. Find Health Samples: Type **VO2 Max**, Start Date **is in the last 30
   days**, Sort by End Date, Latest First, Limit 1. Name it `VO2`.
4. Format Date: Current Date, custom format `yyyy-MM-dd`. Name it `Today`.
5. Get Contents of URL: `https://<production URL>/api/integrations/apple-health/daily-metrics`,
   Method **POST**, the three headers above, Request Body **JSON**:
   `date` (Text) = `Today`, `steps` (Number) = `Steps`,
   `resting_heart_rate` (Number) = `RHR`. Add `vo2_max` (Number) = `VO2` only
   inside an **If VO2 has any value** block (send the request twice, with and
   without it, is simplest); an empty VO2 is rejected.

Shortcut 2, "Fitness morning" (Time of Day, 7:00 AM daily, Run Immediately):

1. Find Health Samples: Type **Sleep Analysis**, Start Date **is in the last
   1 days**. Filter to values Core, Deep, REM (or Asleep on older watches).
   Get Details of Health Sample: **Duration**, then Calculate Statistics:
   **Sum**. Convert to minutes. Name it `Sleep`.
2. Find Health Samples: **Heart Rate Variability**, last 1 days, Calculate
   Statistics **Average**. Name it `HRV`.
3. Resting HR and `Today` as in Shortcut 1.
4. Get Contents of URL: `.../api/integrations/apple-health/sleep`, POST, same
   headers, JSON: `date` = `Today`, `sleep_duration_minutes` = `Sleep`,
   `hrv` = `HRV`, `resting_heart_rate` = `RHR`.

Test each by tapping Run once: the response should be `{"ok":true,...}`; a
`401` means the token or user id is wrong. The sleep step is the fiddly one;
if it fights you, ship Shortcut 1 alone first. It is what ticks the habit.

### Option B (paid, $24.99 one-time): Health Auto Export

Covers everything in Option A plus rides with heart rate, with no shortcut
building. Its REST automation needs the Premium tier: $24.99 lifetime, or a
subscription (App Store listing and the vendor FAQ disagree on the monthly
and annual price as of 2026-10-09; lifetime is the same in both). A 7-day
trial exists. Decision for Nick; not set up.

Point both automations at one endpoint, which takes the app's native JSON:
`POST https://<production URL>/api/integrations/apple-health/health-auto-export`
with the three headers above.

1. Automation "Health Metrics": metrics **Step Count, Resting Heart Rate,
   Heart Rate Variability, VO2 Max, Apple Exercise Time, Active Energy, Sleep
   Analysis**. Format JSON, **Aggregate Data on, by Day**, Date Range
   **Since Last Sync**, Batch Requests on, every 1 hour.
2. Automation "Workouts": Workouts, **Export Version 2**, Include Workout
   Metrics **off**, Include Route **off**, Since Last Sync, every 1 hour.

What the endpoint does with it (`apps/web/src/app/api/integrations/apple-health/health-auto-export.ts`):
only rides become cardio sessions (Zone 2); walks and Watch strength workouts
are dropped so they do not inflate Zone 2 or double-count lifts; when Peloton
and the Watch both record the same ride, the one with heart rate is kept;
weight and body fat are ignored because Withings is the direct source; kJ is
converted to kcal; sleep hours become minutes; daily resting HR and HRV also
land on the recovery check-in so `/recovery` charts them.

### Steps habit

Any active habit whose name contains a step count ("7,000 steps", "8000
steps", "8k steps") is ticked automatically for each synced day at or over
that number. Rename the habit to move the target. A day under target is left
alone, so a manual tick is never undone. The dashboard shows synced steps next
to the habit and the latest VO2 max, with its date, on the Body card.

## Endpoints

| Data | Endpoint | Orchestrator | Target table |
|---|---|---|---|
| Sleep, in-sleep vitals, HRV | `POST /api/integrations/apple-health/sleep` | `AppleHealthSleepSyncOrchestrator` | `recovery_checkins` |
| Daily activity (steps, VO2 max, resting HR, exercise minutes, active energy) | `POST /api/integrations/apple-health/daily-metrics` | `AppleHealthDailyMetricsSyncOrchestrator` | `daily_activity_metrics` |
| Workouts | `POST /api/integrations/apple-health/workouts` | `AppleHealthWorkoutSyncOrchestrator` | `cardio_sessions` |
| Health Auto Export native JSON (all of the above) | `POST /api/integrations/apple-health/health-auto-export` | all three | all three |

All four are gated by `INTEGRATION_ENCRYPTION_KEY` (503 if unset) and the
per-user token (401 if wrong). Bodies are capped at 256 KB and 500 items per
type. Do not point a bridge at a preview deployment.

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

1. Go to `/integrations` (no login since 2026-10-09).
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
