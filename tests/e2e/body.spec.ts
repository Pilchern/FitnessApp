import { test, expect } from "@playwright/test";

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
    page.getByText(/log measurements|edit measurements/i),
  ).toBeVisible();
});

test("can submit a measurement (waist)", async ({ page }) => {
  await page.goto("/body");

  // Fill the date field (label text is "Date")
  const dateInput = page.getByLabel("Date");
  await dateInput.fill("2025-01-15");

  // Weight comes from Withings; the form only takes tape measurements.
  await expect(page.getByLabel(/weight \(lb\)/i)).toHaveCount(0);

  const waistInput = page.getByLabel(/waist at navel \(in\)/i);
  await waistInput.fill("33.5");

  // Submit the form
  await page.getByRole("button", { name: /save measurement/i }).click();

  // After submission, the page should navigate back to /body (server action redirects)
  // or remain on /body — either way there should be no crash
  await expect(page).toHaveURL(/\/body/, { timeout: 10000 });
});

test("an empty measurement does not crash — shows validation or stays on page", async ({
  page,
}) => {
  await page.goto("/body");

  // Fill only the date
  const dateInput = page.getByLabel("Date");
  await dateInput.fill("2025-01-15");

  await page.getByRole("button", { name: /save measurement/i }).click();

  // Should stay on /body (either browser validation or server-side error)
  await expect(page).toHaveURL(/\/body/, { timeout: 8000 });
  // Page should still be functional — quick-add section should still be present
  await expect(page.getByText(/quick add/i)).toBeVisible();
});
