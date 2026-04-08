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
      `[E2E] Login probe failed — weekly-review tests will be skipped. ` +
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

test("authenticated user can view /weekly-review page", async ({ page }) => {
  await page.goto("/weekly-review");
  await expect(page).toHaveURL("/weekly-review");
});

test("weekly-review page shows the 'Weekly review' section heading", async ({
  page,
}) => {
  await page.goto("/weekly-review");
  // The form section has a "Weekly review" eyebrow label
  await expect(
    page.getByText(/weekly review/i).first(),
  ).toBeVisible({ timeout: 8000 });
});

test("weekly-review page shows the 'Weekly metrics' section", async ({
  page,
}) => {
  await page.goto("/weekly-review");
  // h2 rendered inside the form for the auto-filled metrics grid
  await expect(page.getByRole("heading", { name: /weekly metrics/i })).toBeVisible({
    timeout: 8000,
  });
});

test("weekly-review page shows the 'Subjective review' section", async ({
  page,
}) => {
  await page.goto("/weekly-review");
  // h2 for the subjective text fields block
  await expect(
    page.getByRole("heading", { name: /subjective review/i }),
  ).toBeVisible({ timeout: 8000 });
});

test("weekly-review page shows the 'Performance score' aside", async ({
  page,
}) => {
  await page.goto("/weekly-review");
  // The score sidebar uses "Performance score v1" as an eyebrow label
  await expect(page.getByText(/performance score/i)).toBeVisible({
    timeout: 8000,
  });
});

test("weekly-review page renders the week-picker date input and Load week button", async ({
  page,
}) => {
  await page.goto("/weekly-review");
  // The week start date picker has an explicit label "Week start"
  await expect(page.getByLabel("Week start")).toBeVisible({ timeout: 8000 });
  await expect(
    page.getByRole("button", { name: /load week/i }),
  ).toBeVisible();
});

test("weekly-review page renders the save review submit button", async ({
  page,
}) => {
  await page.goto("/weekly-review");
  // Button label is either "Save weekly review" (new) or "Update weekly review" (existing)
  await expect(
    page.getByRole("button", { name: /save weekly review|update weekly review/i }),
  ).toBeVisible({ timeout: 8000 });
});

test("weekly-review page renders subjective fields: Best win, Biggest miss, Lesson, Next week priority", async ({
  page,
}) => {
  await page.goto("/weekly-review");
  await expect(page.getByLabel("Best win")).toBeVisible({ timeout: 8000 });
  await expect(page.getByLabel("Biggest miss")).toBeVisible();
  await expect(page.getByLabel("Lesson")).toBeVisible();
  await expect(page.getByLabel("Next week priority")).toBeVisible();
});

test("weekly-review page renders auto-filled metric fields", async ({
  page,
}) => {
  await page.goto("/weekly-review");
  // Each metric field has a label matched by the AutoField component's htmlFor attribute
  await expect(page.getByLabel("Average weight (lb)")).toBeVisible({
    timeout: 8000,
  });
  await expect(page.getByLabel("Waist (in)")).toBeVisible();
  await expect(page.getByLabel("Rides completed")).toBeVisible();
  await expect(page.getByLabel("Zone 2 minutes")).toBeVisible();
});

test("unauthenticated /weekly-review redirects to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/weekly-review");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});
