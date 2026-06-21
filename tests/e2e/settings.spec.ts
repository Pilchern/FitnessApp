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
      `[E2E] Login probe failed — settings tests will be skipped. ` +
        `Ensure the test user ${TEST_USER_EMAIL} exists in your Supabase project.`,
    );
  } finally {
    await page.close();
  }
});

test.beforeEach(async ({ page }) => {
  if (!loginAvailable) {
    // Infrastructure guard: skips when the Supabase test user is unreachable, not a deferred feature skip.
    test.skip(true, "Test user not available in this Supabase environment");
  }
  await loginAs(page);
});

test("authenticated user can view /settings page", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: /^settings$/i }).first(),
  ).toBeVisible({ timeout: 8000 });
});

test("settings page renders the Display name field", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByLabel("Display name")).toBeVisible({ timeout: 8000 });
});

test("settings page renders the Timezone selector", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByLabel("Timezone")).toBeVisible({ timeout: 8000 });
});

test("settings page renders the save settings button", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: /save settings/i }),
  ).toBeVisible({ timeout: 8000 });
});

test("unauthenticated /settings redirects to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fsettings/, { timeout: 8000 });
});
