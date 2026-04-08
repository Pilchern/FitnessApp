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
      `[E2E] Login probe failed — navigation tests will be skipped. ` +
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

// All nav items from moduleNavigationItems in navigation.ts
const navItems = [
  { title: "Dashboard", href: "/dashboard" },
  { title: "Cardio", href: "/cardio" },
  { title: "Strength", href: "/strength" },
  { title: "Recovery", href: "/recovery" },
  { title: "Body", href: "/body" },
  { title: "Nutrition", href: "/nutrition" },
  { title: "Weekly Review", href: "/weekly-review" },
  { title: "Journal", href: "/journal" },
  { title: "Insights", href: "/insights" },
  { title: "Settings", href: "/settings" },
] as const;

test("all nav links are present on dashboard (desktop sidebar)", async ({
  page,
}) => {
  await page.goto("/dashboard");

  // The sidebar is only visible on lg screens — use a wide viewport
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const item of navItems) {
    // Each nav link is rendered as an anchor with the title as text
    const link = page.getByRole("link", { name: item.title, exact: true });
    await expect(link).toBeVisible();
  }
});

test("can navigate to /cardio", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Cardio", exact: true }).click();
  await expect(page).toHaveURL("/cardio");
});

test("can navigate to /strength", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Strength", exact: true }).click();
  await expect(page).toHaveURL("/strength");
});

test("can navigate to /recovery", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Recovery", exact: true }).click();
  await expect(page).toHaveURL("/recovery");
});

test("can navigate to /body", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Body", exact: true }).click();
  await expect(page).toHaveURL("/body");
});

test("can navigate to /weekly-review", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Weekly Review", exact: true }).click();
  await expect(page).toHaveURL("/weekly-review");
});

test("can navigate to /journal", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Journal", exact: true }).click();
  await expect(page).toHaveURL("/journal");
});

test("can navigate to /insights", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Insights", exact: true }).click();
  await expect(page).toHaveURL("/insights");
});

test("can navigate to /settings", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL("/settings");
});

test("can navigate to /nutrition", async ({ page }) => {
  await page.goto("/dashboard");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("link", { name: "Nutrition", exact: true }).click();
  await expect(page).toHaveURL("/nutrition");
});
