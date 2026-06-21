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
      `[E2E] Login probe failed — recovery tests will be skipped. ` +
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

test("authenticated user can view /recovery page", async ({ page }) => {
  await page.goto("/recovery");
  await expect(page.getByText(/recovery/i).first()).toBeVisible();
});

test("recovery page shows the quick-add form heading", async ({ page }) => {
  await page.goto("/recovery");
  await expect(
    page.getByText(/log recovery in under 20 seconds/i),
  ).toBeVisible({ timeout: 8000 });
});

test("recovery page renders Date and Sleep hours fields", async ({ page }) => {
  await page.goto("/recovery");
  await expect(page.getByLabel("Date")).toBeVisible({ timeout: 8000 });
  await expect(page.getByLabel("Sleep hours")).toBeVisible();
});

test("recovery page renders readiness and energy score buttons", async ({ page }) => {
  await page.goto("/recovery");
  await expect(
    page.getByRole("radiogroup", { name: /readiness 1 to 10/i }),
  ).toBeVisible({ timeout: 8000 });
  await expect(
    page.getByRole("radiogroup", { name: /energy 1 to 10/i }),
  ).toBeVisible();
});

test("recovery page renders the save check-in button", async ({ page }) => {
  await page.goto("/recovery");
  await expect(
    page.getByRole("button", { name: /save check-in/i }),
  ).toBeVisible({ timeout: 8000 });
});

test("unauthenticated /recovery redirects to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/recovery");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Frecovery/, { timeout: 8000 });
});
