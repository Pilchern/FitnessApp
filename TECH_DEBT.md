# Technical Debt Register — FitnessApp

**Last updated:** 2026-04-05 (sprint 3)
**Methodology:** Items are ordered by impact × effort ratio. Fix high-impact, low-effort items first.

---

## Priority 1 — Active Debt

### TD-014: No background job execution infrastructure
- **Severity:** Medium
- **Affected package:** `packages/jobs`
- **Problem:** The jobs package has orchestration logic, but scheduled execution relies on Vercel Cron. No execution infrastructure for non-Vercel environments. No queue, retry logic, or dead-letter handling.
- **Fix:** Either: (a) use Supabase Edge Functions with pg_cron, or (b) use an external queue (Inngest, Trigger.dev). Decision needed before scaling.
- **Effort:** XL (3–5 days depending on approach)

---

## Priority 2 — Low Severity

### TD-016: `listByDateRange` capped at 500 rows
- **Severity:** Low (acceptable for current scale)
- **Affected files:** All 6 infrastructure repository implementations
- **Problem:** Safety cap of 500 rows was added to prevent unbounded queries. Power users with >500 entries in a date range will silently get a truncated result.
- **Fix:** Add a `limit` parameter to repository port interfaces; pass caller-controlled limits from server.ts files; default to 365 for chart views.
- **Effort:** M (requires interface changes across application + infrastructure layers)

### TD-011b: Timezone not validated server-side at signup
- **Severity:** Low
- **Problem:** Timezone sent from the browser as a plain string with no server-side validation that it's a valid IANA timezone identifier. A malformed value would be stored as-is.
- **Fix:** Validate against `Intl.supportedValuesOf('timeZone')` or a Zod enum in the signup action.
- **Effort:** S

---

## Resolved Debt

| ID | Description | Resolved |
|---|---|---|
| TD-R01 | `react/no-unescaped-entities` lint error in `dashboard/page.tsx` | 2026-04-05 |
| TD-R02 | README had duplicate step number (two "5.") | 2026-04-05 |
| TD-001 | Delete actions missing error handling — all delete actions now have try/catch | 2026-04-05 |
| TD-002 | Duplicate `getErrorMessage()` across 7 action files — extracted to `lib/server/get-error-message.ts` | 2026-04-05 |
| TD-003 | Misleading strength validation message — fixed | 2026-04-05 |
| TD-004 | `parseOptionalNumber` duplicated — extracted to `lib/form-utils.ts` | 2026-04-05 |
| TD-005 | `createDependencies()` duplicated — extracted to `lib/server/services.ts` | 2026-04-05 |
| TD-006 | `ensureProfileForUser` running on every render — wrapped with React `cache()` | 2026-04-05 |
| TD-007 | No field-level error display in forms — added `fieldErrors` to body, recovery, cardio forms | 2026-04-05 |
| TD-008 | Dashboard no caching — React `cache()` on supabase client, auth, and profile fetch | 2026-04-05 |
| TD-009 | Unbounded `listByDateRange` queries — `.limit(500)` added to all 6 repositories | 2026-04-05 |
| TD-010 | No shared service composition root — `createCoreServices()` in `lib/server/services.ts` | 2026-04-05 |
| TD-011 | Hardcoded timezone `"America/Chicago"` at signup — browser timezone auto-detected via `Intl` | 2026-04-05 |
| TD-012 | Nutrition module placeholder — full module built | 2026-04-05 |
| TD-013 | No E2E test coverage — Playwright set up with 4 spec files | 2026-04-05 |
| TD-015 | `integration_connection_credentials` RLS/policy gaps — fixed | 2026-04-05 |
