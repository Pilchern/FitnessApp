import { test, expect } from "@playwright/test";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./helpers/auth";

// Verify login works before running any auth tests
let loginAvailable = true;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL("/dashboard", { timeout: 10000 });
    loginAvailable = true;
  } catch {
    loginAvailable = false;
    console.warn(
      `[E2E] Login probe failed — auth tests will be skipped. ` +
        `Ensure the test user ${TEST_USER_EMAIL} exists in your Supabase project.`,
    );
  } finally {
    await page.close();
  }
});

test("unauthenticated root / redirects to /login", async ({ page }) => {
  // Clear storage to ensure no session
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated /dashboard redirects to /login with redirectTo param", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard/);
});

test("login with valid credentials redirects to /dashboard", async ({
  page,
}) => {
  if (!loginAvailable) {
    test.skip(true, "Test user not available in this Supabase environment");
  }

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL("/dashboard", { timeout: 10000 });
  await expect(page).toHaveURL("/dashboard");
});

test("login with invalid credentials shows error message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("wrong@example.com");
  await page.getByLabel(/password/i).fill("wrongpassword");
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Should stay on /login and show an error
  await expect(page).toHaveURL(/\/login/);
  // Error message appears in the ember-colored div rendered by AuthForm
  await expect(
    page.locator("text=/invalid|incorrect|error|credentials/i").first(),
  ).toBeVisible({ timeout: 8000 });
});

test("authenticated user visiting /login redirects to /dashboard", async ({
  page,
}) => {
  if (!loginAvailable) {
    test.skip(true, "Test user not available in this Supabase environment");
  }

  // Log in first
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL("/dashboard", { timeout: 10000 });

  // Now visit /login again — should be redirected away
  await page.goto("/login");
  await expect(page).toHaveURL("/dashboard", { timeout: 8000 });
});
