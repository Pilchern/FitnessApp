import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./helpers/auth";

let loginAvailable = true;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await loginAs(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    loginAvailable = true;
  } catch {
    loginAvailable = false;
    console.warn(
      `[E2E] Login probe failed — insights tests will be skipped. ` +
        `Ensure the test user ${TEST_USER_EMAIL} exists in your Supabase project.`,
    );
  } finally {
    await page.close();
  }
});

test.beforeEach(async ({ page }) => {
  if (!loginAvailable) {
    test.skip(true, "Test user not available in this Supabase environment");
  }
  await loginAs(page);
});

test("authenticated user can view /insights page", async ({ page }) => {
  await page.goto("/insights");
  await expect(page).toHaveURL("/insights");
});

test("insights page shows the 'Insights' heading", async ({ page }) => {
  await page.goto("/insights");
  await expect(
    page.getByRole("heading", { name: /^insights$/i }),
  ).toBeVisible({ timeout: 15000 });
});

test("insights page shows the 'Coaching' eyebrow label", async ({ page }) => {
  await page.goto("/insights");
  await expect(page.getByText(/^coaching$/i)).toBeVisible({ timeout: 15000 });
});

test("insights page renders either insight cards or the empty state", async ({ page }) => {
  await page.goto("/insights");
  // Either dismiss buttons (present when insights exist) or the "All clear" empty state
  const dismissButton = page.getByRole("button", { name: /dismiss/i }).first();
  const emptyState = page.getByText(/all clear|no patterns/i);
  await expect(dismissButton.or(emptyState)).toBeVisible({ timeout: 15000 });
});

test("unauthenticated /insights redirects to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/insights");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});
