import { test, expect } from "@playwright/test";

// Lift logger at phone width. Read-only on purpose: it never taps Finish, so
// it is safe to run against the live database (there is no test database).
// Not run in CI (Playwright needs a live Supabase project); run locally with
// `pnpm exec playwright test tests/e2e/strength.spec.ts`.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("plan loads, a set ticks, and the rest timer and Finish bar stay on screen", async ({
  page,
}) => {
  await page.goto("/strength");

  // Load a plan: today's callout when a lift is scheduled, else the first template.
  const start = page.getByRole("button", { name: "Start workout" });
  if (await start.isVisible()) {
    await start.click();
  } else {
    const load = page.getByRole("button", { name: /load/i }).first();
    test.skip(!(await load.isVisible()), "no strength templates to load");
    await load.click();
  }

  const tick = page.getByRole("button", { name: /Mark set \d+ done/ }).first();
  await expect(tick).toBeVisible();
  await tick.click();

  // Both live in a fixed bar above the tab bar; scroll to the top and they
  // must still be inside the viewport.
  await page.evaluate(() => window.scrollTo(0, 0));
  const rest = page.getByText(/^Rest \d+:\d{2}$/);
  const finish = page.getByRole("button", { name: /Finish workout/ });
  await expect(rest).toBeInViewport();
  await expect(finish).toBeInViewport();
  await expect(finish).toHaveText(/1 of \d+ sets/);
});
