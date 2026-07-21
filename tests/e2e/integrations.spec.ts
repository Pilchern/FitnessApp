import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./helpers/auth";

// Covers the Withings connect/sync entry point on /integrations.
//
// A full OAuth round-trip against Withings' real login page cannot be
// exercised here — it requires leaving the app's domain and completing a
// third-party login this test run does not control. Instead this spec
// verifies everything that IS reachable without leaving the app: the card
// renders correctly, and whichever state this environment is in (not
// configured / configured-but-disconnected / connected), the page never
// crashes and the "Connect Withings" link (when present) points at the
// correct same-origin OAuth kickoff route rather than being clicked through.
let loginAvailable = true;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await loginAs(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    loginAvailable = true;
  } catch {
    loginAvailable = false;
    console.warn(
      `[E2E] Login probe failed — integrations tests will be skipped. ` +
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

test("authenticated user can view /integrations page", async ({ page }) => {
  const response = await page.goto("/integrations");
  await expect(page).toHaveURL("/integrations");
  expect(response?.status()).toBeLessThan(400);
  await expect(
    page.getByRole("heading", { name: /connected apps/i }),
  ).toBeVisible({ timeout: 8000 });
});

test("Withings card renders with heading and description copy", async ({
  page,
}) => {
  await page.goto("/integrations");
  await expect(
    page.getByRole("heading", { name: "Withings", exact: true }),
  ).toBeVisible({ timeout: 8000 });
  await expect(
    page.getByText(
      /automatically import weight, body fat, and muscle mass from your withings scale/i,
    ),
  ).toBeVisible();
});

test("Withings card reflects whatever connection state this environment is in, without crashing", async ({
  page,
}) => {
  await page.goto("/integrations");

  const notConfiguredNotice = page.getByText(
    /withings is not configured in this environment/i,
  );
  const connectLink = page.getByRole("link", { name: /connect withings/i });
  const syncButton = page.getByRole("button", { name: /sync measurements/i });

  // Exactly one of these three states should be true for the Withings card.
  const [notConfiguredVisible, connectVisible, connectedVisible] =
    await Promise.all([
      notConfiguredNotice.isVisible().catch(() => false),
      connectLink.isVisible().catch(() => false),
      syncButton.isVisible().catch(() => false),
    ]);

  expect(
    [notConfiguredVisible, connectVisible, connectedVisible].filter(Boolean)
      .length,
  ).toBe(1);

  if (notConfiguredVisible) {
    await expect(notConfiguredNotice).toBeVisible();
  } else if (connectVisible) {
    // Assert the href without clicking — clicking would navigate off-domain
    // to Withings' real login page, which this test must never do.
    await expect(connectLink).toHaveAttribute(
      "href",
      "/api/integrations/withings/connect",
    );
  } else {
    await expect(syncButton).toBeVisible();
  }
});

test("integrations page does not show an error boundary or leak undefined values", async ({
  page,
}) => {
  await page.goto("/integrations");

  await expect(page.getByText(/application error/i)).toHaveCount(0);
  await expect(page.getByText(/^undefined$/)).toHaveCount(0);
});

test("unauthenticated /integrations redirects to /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/integrations");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});
