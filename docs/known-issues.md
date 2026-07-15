# Known Issues

## Current weak spots

- Playwright E2E covers auth, body, cardio, and weekly-review (4 specs); integration connect/sync flows and the remaining modules (strength, recovery, nutrition, journal, insights, settings) have no browser coverage yet.
- OAuth callback and sync behavior are covered by unit tests, not live-provider integration tests.
- Withings, Peloton, and Apple Health integrations are code-complete but not configured/connected — nutrition and settings are fully implemented, not placeholders.
- Integration credentials are intentionally server-only and require correct service-role usage in deployment.
- Dashboard is still relatively light compared with the underlying data now available.
- No background job queue/retry/dead-letter handling exists — all 4 cron routes are best-effort, per-user error isolation only (see TECH_DEBT.md TD-014).

## Operational cautions

- Withings local testing requires valid OAuth credentials and a base64-encoded 32-byte `INTEGRATION_ENCRYPTION_KEY`.
- Peloton uses the same encryption key but authenticates with a per-user Peloton username/password against an unofficial API — no public API exists, so behavior can change without notice.
- Full resync replays provider data through canonical dedupe; it should not create duplicates, but it can still produce many raw import audit rows.

## QA gaps to close next

- Add browser coverage for integration connect/sync flows and the remaining unspec'd modules.
- Add live sandbox verification for the Withings OAuth flow and a real Peloton-connected sync if credentials are available.
- Add migration smoke tests around sync/import tables.
