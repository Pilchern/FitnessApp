# Known Issues

## Current weak spots

- Playwright E2E covers auth, navigation, body, cardio, integrations connect flow, and weekly-review (6 specs); the remaining modules (strength, recovery, nutrition, journal, insights, settings) have no browser coverage yet.
- OAuth callback and sync behavior are covered by unit tests, not live-provider integration tests.
- Withings, Peloton, and Apple Health integrations are code-complete but not configured/connected — nutrition and settings are fully implemented, not placeholders.
- Integration credentials are intentionally server-only and require correct service-role usage in deployment.
- Background job queue/retry/dead-letter handling exists for the 4 cron routes (Supabase pg_cron + pg_net sweep, TD-014 resolved) — but there is still no cross-provider duplicate detection (TD-019): the same real-world workout or weigh-in landing via two connected providers isn't deduplicated, only same-provider re-imports are.
- No application-level login/signup rate limiting — relies entirely on Supabase Auth's own protections (TD-018).
- Muscle-group/exercise classification is a static, in-code catalog (not user-editable) — exercises outside it are tracked but excluded from muscle-group/push-pull reporting, surfaced via an explicit "unclassified" count rather than silently dropped (TD-021).
- `duration_seconds`/`distance_meters` on strength sets are still unused by the UI, so timed sets (planks) and distance-based movements (carries) can't be logged with those fields yet (TD-020).

## Operational cautions

- Withings local testing requires valid OAuth credentials and a base64-encoded 32-byte `INTEGRATION_ENCRYPTION_KEY`.
- Peloton uses the same encryption key but authenticates with a per-user Peloton username/password against an unofficial API — no public API exists, so behavior can change without notice.
- Full resync replays provider data through canonical dedupe; it should not create duplicates, but it can still produce many raw import audit rows.

## QA gaps to close next

- Add browser coverage for the remaining unspec'd modules (strength, recovery, nutrition, journal, insights, settings).
- Add live sandbox verification for the Withings OAuth flow and a real Peloton-connected sync if credentials are available.
- Add migration smoke tests around sync/import tables.
