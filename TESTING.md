# Testing Guide — FitnessApp

**Last updated:** 2026-04-05

---

## Current Test Status

| Package | Test Files | Tests | Status |
|---|---|---|---|
| `packages/application` | 7 | 30 | All passing |
| `packages/integrations` | 2 | 5 | All passing |
| `packages/jobs` | 1 | 2 | All passing |
| `apps/web` | 2 | 8 | All passing |
| **Total** | **12** | **45** | **All passing** |

---

## Running Tests

```bash
# Run all tests across all packages
pnpm test

# Run tests in a specific package
pnpm --filter application test
pnpm --filter integrations test
pnpm --filter web test

# Run with watch mode (in a specific package directory)
cd packages/application && pnpm vitest

# Run a specific test file
cd packages/application && pnpm vitest src/modules/cardio/cardio.test.ts
```

---

## Test Locations

```
packages/application/src/modules/
  cardio/cardio.test.ts          → Service validation + summary calculations
  recovery/recovery.test.ts      → Recovery checkin validation + scoring
  body-metrics/body-metric.test.ts → Body metric validation + trend calculations
  strength/strength-session.test.ts → Strength session validation + set calculations
  weekly-reviews/weekly-review.test.ts → Weekly review scoring engine
  insights/insight-rules.test.ts → Rule-based insight generation
  validation.test.ts             → Shared validation utilities

packages/integrations/src/
  shared/token-crypto.test.ts    → AES-256-GCM encrypt/decrypt
  providers/withings/withings-adapter.test.ts → Payload normalization

packages/jobs/src/
  orchestration/body-metric-sync.test.ts → Sync orchestration logic

apps/web/src/
  lib/auth.test.ts               → sanitizeRedirectTo, mapAuthErrorMessage
  features/integrations/helpers.test.ts → Integration status helpers

tests/fixtures/                  → Shared test data and provider payloads
tests/e2e/                       → EMPTY — placeholder directory
```

---

## Test Patterns

### 1. Pure Function Tests (Application Layer)
Most tests call a pure function and assert the output:
```typescript
import { buildCardioWeeklyTotals } from "../../index";

it("computes weekly totals", () => {
  expect(buildCardioWeeklyTotals(sessions)).toEqual({
    completedSessions: 2,
    totalMinutes: 82,
    zone2Minutes: 45,
  });
});
```

### 2. Zod Schema Tests
For validation schemas, test both success and failure paths:
```typescript
it("rejects RPE values above 10", () => {
  expect(() =>
    updateCardioSessionSchema.parse({ id: "...", userId: "...", rpe: 11 })
  ).toThrow();
});

it("applies default completion state", () => {
  const parsed = createCardioSessionSchema.parse({ ... });
  expect(parsed.plannedVsCompleted).toBe("completed");
});
```

### 3. Repository Mocking (Services)
When testing services, implement the repository port interface with test doubles:
```typescript
const mockRepo: BodyMetricRepository = {
  findByUserId: vi.fn().mockResolvedValue([]),
  save: vi.fn().mockResolvedValue(undefined),
  // ... other methods
};
const service = new BodyMetricService(mockRepo);
```

### 4. Fixture-Based Tests (Integrations)
Provider payload tests use fixtures from `tests/fixtures/`:
```typescript
import { withingsBodyMeasureFixture } from "../../../../tests/fixtures/withings";
const result = adapter.normalizeBodyMeasure(withingsBodyMeasureFixture);
```

---

## Coverage Gaps (Priority Order)

### Critical Gaps

1. **E2E tests — zero coverage**
   - No browser-level testing for auth redirects, form submissions, or navigation
   - Recommended: Playwright for `/login`, `/body` CRUD, `/cardio` CRUD, `/weekly-review`
   - Priority: High (catch auth and form flow regressions)

2. **Server actions — untested**
   - `createBodyMetricAction`, `createCardioSessionAction`, etc. have no tests
   - Form validation, error handling, redirect behavior are all untested
   - Priority: High

3. **Middleware — untested**
   - `apps/web/src/middleware.ts` auth redirect logic has no tests
   - Priority: Medium (the logic is simple but auth redirects are high-blast-radius)

### Important Gaps

4. **Form schemas — only partially covered**
   - Strength and body form schemas have no unit tests
   - Cardio schema has no tests (only application-layer Zod schema is tested)
   - Priority: Medium

5. **Profile bootstrap — untested**
   - `ensureProfileForUser` is called on every protected render
   - The upsert path and error path are not tested
   - Priority: Medium

6. **Weekly review scoring — partial coverage**
   - Happy path and fragile week are tested; edge cases (empty data, partial data) are not
   - Priority: Medium

7. **Insight rules — only one test scenario**
   - Single scenario covers most rules, but boundary conditions (e.g., exactly 2 missed Saturdays) are not tested
   - Priority: Low

### Lower Priority

8. **Infrastructure repositories** — no integration tests against a real database
9. **Navigation and routing** — URL structure not tested
10. **Settings update flow** — profile update action not tested

---

## How to Add New Tests

### Adding a unit test to an existing package
1. Create `src/modules/<feature>/<feature>.test.ts`
2. Import from the package index: `import { ... } from "../../index"`
3. Use Vitest (`describe`, `it`, `expect`) — no imports from test frameworks
4. Run: `cd packages/<name> && pnpm vitest`

### Adding E2E tests (when Playwright is set up)
1. Write specs in `tests/e2e/<feature>.spec.ts`
2. Use the local seed user: `dev@example.com` / `password1234`
3. Tests should be independent — each test creates its own data
4. Clean up test data after each test (or use isolated test user per suite)

### Regression tests for bugs
When fixing a bug, always add a test that:
1. Sets up the conditions that caused the bug
2. Calls the function or simulates the action
3. Asserts the correct (fixed) behavior
4. Would have failed before the fix

---

## Setting Up Playwright (Future)

When E2E tests are added, use:
```bash
pnpm add -D @playwright/test --filter web
npx playwright install chromium
```

Configure in `apps/web/playwright.config.ts`:
```typescript
export default {
  testDir: "../../tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: { command: "pnpm dev", port: 3000 },
};
```

---

## Quality Gates

All of the following must pass before merging any change:
```bash
pnpm lint       # Zero ESLint errors
pnpm typecheck  # Zero TypeScript errors
pnpm test       # All 45+ tests passing
```

Future: Add `pnpm test:e2e` once Playwright is configured.
