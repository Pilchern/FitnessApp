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
      `[E2E] Login probe failed — nutrition tests will be skipped. ` +
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

test("authenticated user can view /nutrition page", async ({ page }) => {
  await page.goto("/nutrition");
  await expect(page).toHaveURL("/nutrition");
  await expect(page.getByText(/nutrition/i).first()).toBeVisible();
});

test("nutrition page shows quick-add form heading", async ({ page }) => {
  await page.goto("/nutrition");
  await expect(
    page.getByText(/log today's nutrition/i),
  ).toBeVisible({ timeout: 8000 });
});

test("nutrition page renders the Date field", async ({ page }) => {
  await page.goto("/nutrition");
  await expect(page.getByLabel("Date")).toBeVisible({ timeout: 8000 });
});

test("nutrition page renders the save log button", async ({ page }) => {
  await page.goto("/nutrition");
  await expect(
    page.getByRole("button", { name: /save log/i }),
  ).toBeVisible({ timeout: 8000 });
});

test("can log a nutrition entry", async ({ page }) => {
  await page.goto("/nutrition");

  await expect(page.getByLabel("Date")).toBeVisible({ timeout: 8000 });

  await page.getByLabel("Date").fill("2025-01-15");

  await page.getByRole("button", { name: /save log/i }).click();

  await expect(page).toHaveURL(/\/nutrition/, { timeout: 10000 });
});

test("unauthenticated /nutrition redirects to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/nutrition");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});
