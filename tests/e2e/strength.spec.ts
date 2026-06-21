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
      `[E2E] Login probe failed — strength tests will be skipped. ` +
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

test("authenticated user can view /strength page", async ({ page }) => {
  await page.goto("/strength");
  await expect(page).toHaveURL("/strength");
  await expect(
    page.getByRole("heading", { name: /strength/i }).first(),
  ).toBeVisible({ timeout: 8000 });
});

test("strength page shows the 'This week' eyebrow label", async ({ page }) => {
  await page.goto("/strength");
  await expect(page.getByText(/this week/i)).toBeVisible({ timeout: 8000 });
});

test("strength page renders the session log form", async ({ page }) => {
  await page.goto("/strength");
  // The form has a date input for session date
  await expect(page.getByLabel(/date/i).first()).toBeVisible({ timeout: 8000 });
});

test("unauthenticated /strength redirects to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/strength");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});
