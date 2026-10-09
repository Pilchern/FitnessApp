import { test, expect } from "@playwright/test";

test("authenticated user can view /cardio page", async ({ page }) => {
  await page.goto("/cardio");
  await expect(page).toHaveURL("/cardio");
  await expect(page.getByText(/cardio/i).first()).toBeVisible();
});

test("can log a cardio session (zone2, 45 min)", async ({ page }) => {
  await page.goto("/cardio");

  // Wait for the quick-add form to be present
  await expect(
    page.getByText(/log a ride in under 30 seconds|edit ride/i),
  ).toBeVisible({ timeout: 8000 });

  // Fill date
  const dateInput = page.getByLabel("Date");
  await dateInput.fill("2025-01-15");

  // Select session type — "Zone 2" is the default, but explicitly select it
  const sessionKindSelect = page.getByLabel(/session type/i);
  await sessionKindSelect.selectOption("zone2");

  // Fill duration
  const durationInput = page.getByLabel(/duration \(min\)/i);
  await durationInput.fill("45");

  // Submit — button says "Log ride"
  await page.getByRole("button", { name: /log ride/i }).click();

  // After submission, should stay on /cardio or redirect back to /cardio
  await expect(page).toHaveURL(/\/cardio/, { timeout: 10000 });
});
