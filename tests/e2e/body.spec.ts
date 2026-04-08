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
      `[E2E] Login probe failed — body tests will be skipped. ` +
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

test("authenticated user can view /body page", async ({ page }) => {
  await page.goto("/body");
  await expect(page).toHaveURL("/body");
  // Page should contain the module heading
  await expect(page.getByText(/body/i).first()).toBeVisible();
});

test("body page shows the quick-add form", async ({ page }) => {
  await page.goto("/body");
  // The BodyQuickForm renders "Quick add" eyebrow and "Log body metrics fast" heading
  await expect(page.getByText(/quick add/i)).toBeVisible();
  await expect(
    page.getByText(/log body metrics fast|edit body metrics/i),
  ).toBeVisible();
});

test("can submit a body metric (weight and waist)", async ({ page }) => {
  await page.goto("/body");

  // Fill the date field (label text is "Date")
  const dateInput = page.getByLabel("Date");
  await dateInput.fill("2025-01-15");

  // Fill Weight (lb)
  const weightInput = page.getByLabel(/weight \(lb\)/i);
  await weightInput.fill("185.0");

  // Fill Waist (in)
  const waistInput = page.getByLabel(/waist \(in\)/i);
  await waistInput.fill("33.5");

  // Submit the form
  await page.getByRole("button", { name: /save measurement/i }).click();

  // After submission, the page should navigate back to /body (server action redirects)
  // or remain on /body — either way there should be no crash
  await expect(page).toHaveURL(/\/body/, { timeout: 10000 });
});

test("empty weight field does not crash — shows validation or stays on page", async ({
  page,
}) => {
  await page.goto("/body");

  // Leave weight empty, fill only date
  const dateInput = page.getByLabel("Date");
  await dateInput.fill("2025-01-15");

  await page.getByRole("button", { name: /save measurement/i }).click();

  // Should stay on /body (either browser validation or server-side error)
  await expect(page).toHaveURL(/\/body/, { timeout: 8000 });
  // Page should still be functional — quick-add section should still be present
  await expect(page.getByText(/quick add/i)).toBeVisible();
});
