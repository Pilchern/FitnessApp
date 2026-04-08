# Portability Audit

## Current boundary quality

- `packages/domain` remains framework-free and portable.
- `packages/application` owns validation, DTOs, use cases, and repository contracts without Next.js or Supabase imports.
- `packages/infrastructure` contains Supabase-specific persistence mapping and keeps raw rows from leaking into feature code.
- `packages/integrations` isolates provider payload shapes, OAuth exchange logic, token crypto, and mapping rules.
- `packages/jobs` orchestrates sync flows without leaking provider payloads into product modules.
- `apps/web` still owns all Next.js route handlers, server actions, redirects, cookies, and route protection.

## Framework coupling review

Acceptable web-only coupling:

- route handlers under `apps/web/src/app/api`
- server actions under `apps/web/src/features/*/actions.ts`
- redirects and cookie/session handling in `apps/web/src/lib/server`

Coupling that was reviewed in this pass:

- integration sync logic stays out of page files and out of feature modules
- raw provider payloads stop in integration and infrastructure layers
- user-facing modules read canonical records only

## Remaining portability weak spots

- web server actions still manually compose repositories per feature; a future shared composition root could reduce repeated web wiring
- auth behavior is currently web-first and Supabase-session-specific
- no alternate client package exists yet for mobile or desktop view models

## Recommendation for next release

1. Introduce shared application composition helpers for feature services.
2. Add cross-client DTO/view-model mappers where mobile reuse is expected first.
3. Add one non-web consumer prototype for a small read-only screen to validate boundaries early.
