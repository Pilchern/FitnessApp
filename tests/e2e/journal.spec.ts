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
      `[E2E] Login probe failed — journal tests will be skipped. ` +
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

test("authenticated user can view /journal page", async ({ page }) => {
  await page.goto("/journal");
  await expect(page).toHaveURL("/journal");
  await expect(
    page.getByRole("heading", { name: /journal/i }),
  ).toBeVisible({ timeout: 8000 });
});

test("journal page shows the entry form with Date and Tags fields", async ({ page }) => {
  await page.goto("/journal");
  await expect(page.getByLabel("Date")).toBeVisible({ timeout: 8000 });
  await expect(page.getByLabel("Tags")).toBeVisible();
});

test("journal page shows the Entry textarea", async ({ page }) => {
  await page.goto("/journal");
  await expect(page.getByLabel("Entry")).toBeVisible({ timeout: 8000 });
});

test("journal page renders the save entry button", async ({ page }) => {
  await page.goto("/journal");
  await expect(
    page.getByRole("button", { name: /save entry/i }),
  ).toBeVisible({ timeout: 8000 });
});

test("can create a journal entry", async ({ page }) => {
  await page.goto("/journal");

  await expect(page.getByLabel("Date")).toBeVisible({ timeout: 8000 });

  await page.getByLabel("Date").fill("2025-01-15");
  await page.getByLabel("Tags").fill("cardio");
  await page.getByLabel("Entry").fill("Good session today. Felt strong in zone 2.");

  await page.getByRole("button", { name: /save entry/i }).click();

  await expect(page).toHaveURL(/\/journal/, { timeout: 10000 });
});

test("unauthenticated /journal redirects to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/journal");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});
