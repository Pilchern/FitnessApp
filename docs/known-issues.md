# Known Issues

## Current weak spots

- No browser e2e suite exists yet for auth, logging, or integration flows.
- OAuth callback and sync behavior are covered by unit tests, not live-provider integration tests.
- Nutrition and settings are still placeholder routes.
- Integration credentials are intentionally server-only and require correct service-role usage in deployment.
- Dashboard is still relatively light compared with the underlying data now available.

## Operational cautions

- Withings local testing requires valid OAuth credentials and a base64-encoded 32-byte `INTEGRATION_ENCRYPTION_KEY`.
- Full resync replays provider data through canonical dedupe; it should not create duplicates, but it can still produce many raw import audit rows.

## QA gaps to close next

- Add browser coverage for auth redirects and module CRUD happy paths.
- Add live sandbox verification for the Withings OAuth flow if credentials are available.
- Add migration smoke tests around sync/import tables.
